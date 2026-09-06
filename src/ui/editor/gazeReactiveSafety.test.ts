import { describe, expect, it } from 'vitest'
import { isGazeCanvasSafe, resolveEyeExpression, type FaceModel } from '../../core/model'
import {
  setIndependentGazeReactiveSafely,
  setSharedGazeReactiveSafely,
} from './gazeReactiveSafety'

const model: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 40, y: 32 }, width: 28, height: 20, cornerRadius: 8, rotation: 0 } },
  rightEye: { geometry: { position: { x: 88, y: 32 }, width: 28, height: 20, cornerRadius: 8, rotation: 0 } },
  gaze: { x: -8, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0, gazeHeightExpansion: 0.2, gazeHeightThreshold: 0.1 },
  colors: { eye: '#fff', background: '#000' },
}

describe('gaze-reactive expression safety', () => {
  it('supports linked editing and clears asymmetric overrides', () => {
    const withOverride: FaceModel = {
      ...model,
      expression: { ...model.expression, leftEye: { gazeHeightExpansion: 0.6 } },
    }
    const next = setSharedGazeReactiveSafely(withOverride, 'gazeHeightExpansion', 0.35)
    expect(next.expression.leftEye).toBeUndefined()
    expect(next.expression.rightEye).toBeUndefined()
    expect(next.expression.gazeHeightExpansion).toBeCloseTo(0.35)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('supports independent-eye strength overrides', () => {
    const next = setIndependentGazeReactiveSafely(model, 'left', 'gazeHeightExpansion', 0.45)
    expect(resolveEyeExpression(next.expression, 'left').gazeHeightExpansion).toBeCloseTo(0.45)
    expect(resolveEyeExpression(next.expression, 'right').gazeHeightExpansion).toBeCloseTo(0.2)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('clamps unsafe expansion changes instead of pushing the visible eye outside the canvas', () => {
    const tight: FaceModel = {
      ...model,
      canvas: { width: 128, height: 36 },
      leftEye: { geometry: { ...model.leftEye.geometry, position: { x: 40, y: 18 }, height: 30 } },
      rightEye: { geometry: { ...model.rightEye.geometry, position: { x: 88, y: 18 }, height: 30 } },
      gaze: { x: -24, y: 0 },
      expression: { ...model.expression, gazeHeightExpansion: 0 },
    }
    const next = setSharedGazeReactiveSafely(tight, 'gazeHeightExpansion', 1)
    expect(next.expression.gazeHeightExpansion).toBeLessThan(1)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })
})
