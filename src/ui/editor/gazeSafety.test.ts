import { describe, expect, it } from 'vitest'
import { canFitEyesInCanvas, isGazeCanvasSafe, type FaceModel } from '../../core/model'
import { setGazeSafely } from './gazeSafety'

const base: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 35, y: 32 }, width: 20, height: 50, cornerRadius: 8, rotation: 0 } },
  rightEye: { geometry: { position: { x: 93, y: 32 }, width: 20, height: 50, cornerRadius: 8, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: {
    upperLid: 0,
    lowerLid: 0,
    tilt: 0,
    gazeHeightExpansion: 1,
    gazeHeightThreshold: 0,
  },
  colors: { eye: '#ffffff', background: '#000000' },
}

describe('gaze safety with reactive expression geometry', () => {
  it('stops horizontal gaze before a reactive height expansion would overflow the canvas', () => {
    const next = setGazeSafely(base, 'x', -24)

    expect(next.gaze.x).toBeGreaterThan(-24)
    expect(canFitEyesInCanvas(next)).toBe(true)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('mirrors the same safety behavior on the right side', () => {
    const next = setGazeSafely(base, 'x', 24)

    expect(next.gaze.x).toBeLessThan(24)
    expect(canFitEyesInCanvas(next)).toBe(true)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })

  it('allows an otherwise safe gaze request unchanged', () => {
    const roomy: FaceModel = {
      ...base,
      canvas: { width: 128, height: 128 },
    }
    const next = setGazeSafely(roomy, 'x', -20)

    expect(next.gaze.x).toBe(-20)
    expect(canFitEyesInCanvas(next)).toBe(true)
    expect(isGazeCanvasSafe(next)).toBe(true)
  })
})
