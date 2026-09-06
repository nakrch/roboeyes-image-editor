import { describe, expect, it } from 'vitest'
import { canFitEyesInCanvas, visibleEyesOverlap } from '../../core/model'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  anchoredPairSpacing,
  setSharedExpressionGeometrySafely,
} from './geometrySafety'
import { pairRotationCenter, rotatePairSafely } from './modelEditing'
import {
  independentEyeDimensionLimits,
  linkedEyeDimensionLimits,
  linkedEyeDimensionRanges,
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

  it('does not collapse linked Eye width to 1 under expression tilt', () => {
    const tilts = [-30, -24, -18, 18, 24, 30]
    const dynamicMinimums: number[] = []

    for (const requestedTilt of tilts) {
      const tilted = setSharedExpressionGeometrySafely(createModel(), 'tilt', requestedTilt)
      const range = linkedEyeDimensionRanges(tilted).width
      dynamicMinimums.push(range.min)

      const reduced = setLinkedEyeDimensionSafely(tilted, 'width', 1)
      expect(reduced.leftEye.geometry.width).toBeCloseTo(range.min, 5)
      expect(reduced.rightEye.geometry.width).toBeCloseTo(range.min, 5)
      expect(canFitEyesInCanvas(reduced)).toBe(true)
      expect(visibleEyesOverlap(reduced)).toBe(false)

      const reducedRange = linkedEyeDimensionRanges(reduced).width
      const raiseTarget = Math.min(reducedRange.max, reduced.leftEye.geometry.width + 4)
      const raised = setLinkedEyeDimensionSafely(reduced, 'width', raiseTarget)
      expect(raised.leftEye.geometry.width).toBeGreaterThanOrEqual(reduced.leftEye.geometry.width - 1e-6)
      expect(canFitEyesInCanvas(raised)).toBe(true)
      expect(visibleEyesOverlap(raised)).toBe(false)
    }

    expect(dynamicMinimums.some((minimum) => minimum > 1.01)).toBe(true)
  })

  it('keeps linked width in a contiguous safe range with tilt and rotation combined', () => {
    const tilted = setSharedExpressionGeometrySafely(createModel(), 'tilt', 24)
    const model = rotatePairSafely(tilted, 12)
    const centerBefore = pairRotationCenter(model)
    const axisBefore = pairAxis(model)
    const spacingBefore = anchoredPairSpacing(model)
    const range = linkedEyeDimensionRanges(model).width

    const reduced = setLinkedEyeDimensionSafely(model, 'width', range.min - 50)
    const raised = setLinkedEyeDimensionSafely(reduced, 'width', reduced.leftEye.geometry.width + 3)

    expect(reduced.leftEye.geometry.width).toBeCloseTo(range.min, 5)
    expect(raised.leftEye.geometry.width).toBeGreaterThanOrEqual(reduced.leftEye.geometry.width - 1e-6)
    expect(pairRotationCenter(raised).x).toBeCloseTo(centerBefore.x, 6)
    expect(pairRotationCenter(raised).y).toBeCloseTo(centerBefore.y, 6)
    expect(pairAxis(raised).x).toBeCloseTo(axisBefore.x, 6)
    expect(pairAxis(raised).y).toBeCloseTo(axisBefore.y, 6)
    expect(anchoredPairSpacing(raised)).toBeCloseTo(spacingBefore, 6)
    expect(canFitEyesInCanvas(raised)).toBe(true)
    expect(visibleEyesOverlap(raised)).toBe(false)
  })
})
