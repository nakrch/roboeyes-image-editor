import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { canFitEyesInCanvas, isGazeCanvasSafe, visibleEyesOverlap, type FaceModel } from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { independentEyeRotationRange, setIndependentEyeRotationSafely } from './eyeRotationSafety'
import { pairRotationCenter, pairRotationLimits, rotatePair, rotatePairSafely } from './modelEditing'
import { enableSingleEyeLayout } from './singleEyeLayout'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

function orbit(position: { x: number; y: number }, model: FaceModel, degrees: number) {
  const centerX = model.canvas.width / 2
  const centerY = model.canvas.height / 2
  const radians = degrees * Math.PI / 180
  const x = position.x - centerX
  const y = position.y - centerY
  return {
    x: centerX + x * Math.cos(radians) - y * Math.sin(radians),
    y: centerY + x * Math.sin(radians) + y * Math.cos(radians),
  }
}

describe('rotation pivot', () => {
  it('orbits both eyes and their midpoint around the display while adding the angle to each eye', () => {
    const initial = createModel()
    const model = {
      ...initial,
      leftEye: { ...initial.leftEye, geometry: { ...initial.leftEye.geometry, position: { x: 42, y: 27 }, rotation: -4 } },
      rightEye: { ...initial.rightEye, geometry: { ...initial.rightEye.geometry, position: { x: 84, y: 33 }, rotation: 8 } },
    }
    const rotated = rotatePair(model, 17, 'display')
    for (const side of ['leftEye', 'rightEye'] as const) {
      const expected = orbit(model[side].geometry.position, model, 15)
      expect(rotated[side].geometry.position.x).toBeCloseTo(expected.x)
      expect(rotated[side].geometry.position.y).toBeCloseTo(expected.y)
      expect(rotated[side].geometry.rotation).toBe(model[side].geometry.rotation + 15)
    }
    const midpoint = orbit(pairRotationCenter(model), model, 15)
    expect(pairRotationCenter(rotated).x).toBeCloseTo(midpoint.x)
    expect(pairRotationCenter(rotated).y).toBeCloseTo(midpoint.y)
  })

  it('orbits only the independently rotated eye and keeps every sampled value safe', () => {
    const model = createModel()
    const range = independentEyeRotationRange(model, 'left', 'display')
    expect(range.min).toBeGreaterThanOrEqual(-45)
    expect(range.max).toBeLessThanOrEqual(45)
    for (let index = 0; index <= 20; index += 1) {
      const angle = range.min + (range.max - range.min) * index / 20
      const rotated = setIndependentEyeRotationSafely(model, 'left', angle, 'display')
      const expected = orbit(model.leftEye.geometry.position, model, angle - model.leftEye.geometry.rotation)
      expect(rotated.leftEye.geometry.position.x).toBeCloseTo(expected.x)
      expect(rotated.leftEye.geometry.position.y).toBeCloseTo(expected.y)
      expect(rotated.leftEye.geometry.rotation).toBeCloseTo(angle)
      expect(rotated.rightEye).toBe(model.rightEye)
      expect(canFitEyesInCanvas(rotated) && isGazeCanvasSafe(rotated) && !visibleEyesOverlap(rotated)).toBe(true)
    }
  })

  it('retains the hidden eye offset when orbiting a single eye', () => {
    const centered = enableSingleEyeLayout(createModel())
    const model = {
      ...centered,
      leftEye: { ...centered.leftEye, geometry: { ...centered.leftEye.geometry, position: { x: 70, y: 32 } } },
      rightEye: { ...centered.rightEye, geometry: { ...centered.rightEye.geometry, position: { x: centered.rightEye.geometry.position.x + 6, y: 32 } } },
    }
    const before = model.rightEye.geometry.position.x - model.leftEye.geometry.position.x
    const rotated = setIndependentEyeRotationSafely(model, 'left', 8, 'display')
    expect(rotated.leftEye.geometry.position).not.toEqual(model.leftEye.geometry.position)
    expect(rotated.rightEye.geometry.position.x - rotated.leftEye.geometry.position.x).toBeCloseTo(before)
    expect(rotated.rightEye.geometry.position.y - rotated.leftEye.geometry.position.y).toBeCloseTo(model.rightEye.geometry.position.y - model.leftEye.geometry.position.y)
  })

  it('keeps linked display ranges within ±45 and canvas-safe throughout', () => {
    const model = createModel()
    const range = pairRotationLimits(model, 'display')
    expect(range.min).toBeGreaterThanOrEqual(-45)
    expect(range.max).toBeLessThanOrEqual(45)
    for (let index = 0; index <= 20; index += 1) {
      const angle = range.min + (range.max - range.min) * index / 20
      expect(canFitEyesInCanvas(rotatePair(model, angle, 'display'))).toBe(true)
    }
  })

  it('preserves default local rotation behavior exactly', () => {
    const model = createModel()
    expect(rotatePair(model, 12)).toEqual(rotatePair(model, 12, 'local'))
    expect(pairRotationLimits(model)).toEqual(pairRotationLimits(model, 'local'))
    expect(rotatePairSafely(model, 45)).toEqual(rotatePairSafely(model, 45, 'local'))
    expect(independentEyeRotationRange(model, 'left')).toEqual(independentEyeRotationRange(model, 'left', 'local'))
    expect(setIndependentEyeRotationSafely(model, 'left', 12)).toEqual(setIndependentEyeRotationSafely(model, 'left', 12, 'local'))
  })
})
