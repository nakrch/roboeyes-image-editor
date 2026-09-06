import { describe, expect, it } from 'vitest'
import { canFitEyesInCanvas, isGazeCanvasSafe, visibleEyesOverlap } from '../../core/model'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { anchoredPairSpacing } from './geometrySafety'
import { pairRotationCenter, rotatePairSafely } from './modelEditing'
import {
  canvasSafeAnchoredPairSpacingMax,
  setCanvasSafeAnchoredPairSpacing,
} from './spacingCanvasSafety'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

function pairAxis(model: ReturnType<typeof createModel>) {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  const dx = right.x - left.x
  const dy = right.y - left.y
  const length = Math.hypot(dx, dy)
  return { x: dx / length, y: dy / length }
}

describe('canvas-safe anchored spacing', () => {
  it('clamps spacing before a safely rotated pair can leave the canvas', () => {
    const rotated = rotatePairSafely(createModel(), 24)
    expect(canFitEyesInCanvas(rotated)).toBe(true)

    const centerBefore = pairRotationCenter(rotated)
    const axisBefore = pairAxis(rotated)
    const maximum = canvasSafeAnchoredPairSpacingMax(rotated)

    expect(maximum).toBeLessThan(160)

    const next = setCanvasSafeAnchoredPairSpacing(rotated, 160)
    const centerAfter = pairRotationCenter(next)
    const axisAfter = pairAxis(next)

    expect(anchoredPairSpacing(next)).toBeCloseTo(maximum, 5)
    expect(canFitEyesInCanvas(next)).toBe(true)
    expect(isGazeCanvasSafe(next)).toBe(true)
    expect(visibleEyesOverlap(next)).toBe(false)
    expect(centerAfter.x).toBeCloseTo(centerBefore.x, 7)
    expect(centerAfter.y).toBeCloseTo(centerBefore.y, 7)
    expect(axisAfter.x).toBeCloseTo(axisBefore.x, 7)
    expect(axisAfter.y).toBeCloseTo(axisBefore.y, 7)
  })

  it('rejects an impossible spacing request after safe rotation', () => {
    const rotated = rotatePairSafely(createModel(), 20)
    expect(canFitEyesInCanvas(rotated)).toBe(true)

    const next = setCanvasSafeAnchoredPairSpacing(rotated, 10_000)

    expect(canFitEyesInCanvas(next)).toBe(true)
    expect(isGazeCanvasSafe(next)).toBe(true)
    expect(visibleEyesOverlap(next)).toBe(false)
    expect(anchoredPairSpacing(next)).toBeLessThan(160)
  })
})
