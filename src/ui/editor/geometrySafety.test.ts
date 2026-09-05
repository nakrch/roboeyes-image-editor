import { describe, expect, it } from 'vitest'
import { isGazeCanvasSafe } from '../../core/model'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { pairRotationCenter, rotatePair } from './modelEditing'
import {
  anchoredPairSpacing,
  setAnchoredPairSpacingSafely,
  setSharedExpressionGeometrySafely,
  sharedExpressionGeometryRange,
} from './geometrySafety'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

function axis(model: ReturnType<typeof createModel>) {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  const dx = right.x - left.x
  const dy = right.y - left.y
  const length = Math.hypot(dx, dy)
  return { x: dx / length, y: dy / length }
}

describe('anchored geometry safety', () => {
  it('changes spacing along the current rotated pair axis without moving the pair center', () => {
    const rotated = rotatePair(createModel(), 25)
    const centerBefore = pairRotationCenter(rotated)
    const axisBefore = axis(rotated)

    const next = setAnchoredPairSpacingSafely(rotated, anchoredPairSpacing(rotated) + 8)
    const centerAfter = pairRotationCenter(next)
    const axisAfter = axis(next)

    expect(centerAfter.x).toBeCloseTo(centerBefore.x)
    expect(centerAfter.y).toBeCloseTo(centerBefore.y)
    expect(axisAfter.x).toBeCloseTo(axisBefore.x)
    expect(axisAfter.y).toBeCloseTo(axisBefore.y)
    expect(anchoredPairSpacing(next)).toBeGreaterThan(anchoredPairSpacing(rotated))
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('clamps expression tilt before it would require moving the current gaze', () => {
    const model = createModel()
    model.gaze = { x: 0, y: 10 }
    const range = sharedExpressionGeometryRange(model, 'tilt')
    const next = setSharedExpressionGeometrySafely(model, 'tilt', 30)

    expect(next.expression.tilt).toBeLessThanOrEqual(range.max + 1e-8)
    expect(next.gaze).toEqual(model.gaze)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('clamps eye height scale before it would require moving the current gaze', () => {
    const model = createModel()
    model.gaze = { x: 0, y: 12 }
    const range = sharedExpressionGeometryRange(model, 'heightScale')
    const next = setSharedExpressionGeometrySafely(model, 'heightScale', 1.5)

    expect(next.expression.heightScale ?? 1).toBeLessThanOrEqual(range.max + 1e-8)
    expect(next.gaze).toEqual(model.gaze)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })
})
