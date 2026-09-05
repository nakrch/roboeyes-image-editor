import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  movePair,
  pairCenterX,
  pairCenterY,
  pairRotation,
  pairRotationCenter,
  pairSpacing,
  resizeCanvasFromCenter,
  rotatePair,
  setHorizontalLayout,
} from './modelEditing'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

const centerDistance = (model: ReturnType<typeof createModel>) => {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  return Math.hypot(right.x - left.x, right.y - left.y)
}

describe('generic editor model operations', () => {
  it('updates linked widths while preserving pair center and edge spacing', () => {
    const model = createModel()
    const next = setHorizontalLayout(model, 48, 48, pairSpacing(model))

    expect(pairCenterX(next)).toBe(pairCenterX(model))
    expect(pairSpacing(next)).toBe(12)
    expect(next.leftEye.geometry.width).toBe(48)
    expect(next.rightEye.geometry.width).toBe(48)
  })

  it('moves the eye pair without changing its geometry', () => {
    const model = createModel()
    const next = movePair(model, 80, 40)

    expect(pairCenterX(next)).toBe(80)
    expect(pairCenterY(next)).toBe(40)
    expect(pairSpacing(next)).toBe(pairSpacing(model))
    expect(next.leftEye.geometry.width).toBe(model.leftEye.geometry.width)
  })

  it('recenters the face when applying a resolution preset', () => {
    const model = createModel()
    const next = resizeCanvasFromCenter(model, 320, 240)

    expect(next.canvas).toEqual({ width: 320, height: 240 })
    expect(pairCenterX(next)).toBe(160)
    expect(pairCenterY(next)).toBe(120)
    expect(pairSpacing(next)).toBe(pairSpacing(model))
  })

  it('keeps a zero-degree pair rotation unchanged', () => {
    const model = createModel()

    expect(rotatePair(model, 0)).toBe(model)
  })

  it('rotates both eyes around their shared center for a positive angle', () => {
    const model = createModel()
    const centerBefore = pairRotationCenter(model)
    const distanceBefore = centerDistance(model)

    const next = rotatePair(model, 30)
    const centerAfter = pairRotationCenter(next)

    expect(centerAfter.x).toBeCloseTo(centerBefore.x)
    expect(centerAfter.y).toBeCloseTo(centerBefore.y)
    expect(centerDistance(next)).toBeCloseTo(distanceBefore)
    expect(pairRotation(next)).toBeCloseTo(30)
    expect(next.leftEye.geometry.position.y).toBeLessThan(centerBefore.y)
    expect(next.rightEye.geometry.position.y).toBeGreaterThan(centerBefore.y)
  })

  it('rotates the pair in the opposite direction for a negative angle', () => {
    const model = createModel()
    const center = pairRotationCenter(model)

    const next = rotatePair(model, -30)

    expect(pairRotation(next)).toBeCloseTo(-30)
    expect(next.leftEye.geometry.position.y).toBeGreaterThan(center.y)
    expect(next.rightEye.geometry.position.y).toBeLessThan(center.y)
  })

  it('preserves relative per-eye tilt while changing the group angle', () => {
    const model = createModel()
    model.leftEye.geometry.rotation = -5
    model.rightEye.geometry.rotation = 5

    const next = rotatePair(model, 20)

    expect(next.leftEye.geometry.rotation).toBeCloseTo(15)
    expect(next.rightEye.geometry.rotation).toBeCloseTo(25)
  })
})
