import { describe, expect, it } from 'vitest'
import { canFitEyesInCanvas } from '../../core/model'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { anchoredPairSpacing } from './geometrySafety'
import { pairRotationCenter, rotatePairSafely } from './modelEditing'
import {
  independentEyeDimensionLimits,
  linkedEyeDimensionLimits,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from './eyeDimensions'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

function pairAxis(model: ReturnType<typeof createModel>) {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  const dx = right.x - left.x
  const dy = right.y - left.y
  const length = Math.hypot(dx, dy)
  return { x: dx / length, y: dy / length }
}

describe('eye dimension constraints', () => {
  it('limits linked width to a canvas-safe maximum', () => {
    const model = createModel()
    const limits = linkedEyeDimensionLimits(model)
    const next = setLinkedEyeDimensionSafely(model, 'width', 160)

    expect(limits.width).toBeLessThan(160)
    expect(next.leftEye.geometry.width).toBeCloseTo(limits.width)
    expect(next.rightEye.geometry.width).toBeCloseTo(limits.width)
    expect(anchoredPairSpacing(next)).toBeCloseTo(anchoredPairSpacing(model))
    expect(canFitEyesInCanvas(next)).toBe(true)
  })

  it('limits linked height to a canvas-safe maximum', () => {
    const model = createModel()
    const limits = linkedEyeDimensionLimits(model)
    const next = setLinkedEyeDimensionSafely(model, 'height', 160)

    expect(limits.height).toBeLessThan(160)
    expect(next.leftEye.geometry.height).toBeCloseTo(limits.height)
    expect(next.rightEye.geometry.height).toBeCloseTo(limits.height)
    expect(canFitEyesInCanvas(next)).toBe(true)
  })

  it('limits only the edited eye in independent mode', () => {
    const model = createModel()
    const originalRight = model.rightEye.geometry.width
    const limits = independentEyeDimensionLimits(model, 'left')
    const next = setIndependentEyeDimensionSafely(model, 'left', 'width', 160)

    expect(limits.width).toBeLessThan(160)
    expect(next.leftEye.geometry.width).toBeCloseTo(limits.width)
    expect(next.rightEye.geometry.width).toBe(originalRight)
    expect(canFitEyesInCanvas(next)).toBe(true)
  })

  it('preserves pair center, axis, and anchored spacing when linked width changes after rotation', () => {
    const rotated = rotatePairSafely(createModel(), 15)
    const centerBefore = pairRotationCenter(rotated)
    const axisBefore = pairAxis(rotated)
    const spacingBefore = anchoredPairSpacing(rotated)

    const next = setLinkedEyeDimensionSafely(rotated, 'width', 30)
    const centerAfter = pairRotationCenter(next)
    const axisAfter = pairAxis(next)

    expect(next.leftEye.geometry.width).not.toBeCloseTo(rotated.leftEye.geometry.width)
    expect(centerAfter.x).toBeCloseTo(centerBefore.x, 7)
    expect(centerAfter.y).toBeCloseTo(centerBefore.y, 7)
    expect(axisAfter.x).toBeCloseTo(axisBefore.x, 7)
    expect(axisAfter.y).toBeCloseTo(axisBefore.y, 7)
    expect(anchoredPairSpacing(next)).toBeCloseTo(spacingBefore, 7)
    expect(canFitEyesInCanvas(next)).toBe(true)
  })
})
