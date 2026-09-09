import { describe, expect, it } from 'vitest'
import {
  canFitEyesInCanvas,
  gazeLimits,
  isGazeCanvasSafe,
  minimumCanvasSize,
  visibleEyesOverlap,
  type FaceModel,
} from './index'

const base: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 64, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  rightEye: { geometry: { position: { x: 112, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#fff', background: '#000' },
}

describe('single-eye model safety', () => {
  it('ignores hidden-eye bounds when deriving canvas and gaze safety', () => {
    const pairLimits = gazeLimits(base)
    const single: FaceModel = {
      ...base,
      eyeVisibility: { left: true, right: false },
      rightEye: {
        geometry: { ...base.rightEye.geometry, position: { x: 500, y: 500 } },
      },
    }

    expect(canFitEyesInCanvas(single)).toBe(true)
    expect(isGazeCanvasSafe(single)).toBe(true)
    expect(gazeLimits(single).x.max).toBeGreaterThan(pairLimits.x.max)
    expect(minimumCanvasSize(single).width).toBeLessThan(base.canvas.width)
    expect(visibleEyesOverlap(single)).toBe(false)
  })

  it('treats omitted visibility as the original two-eye model', () => {
    expect(canFitEyesInCanvas(base)).toBe(true)
    expect(visibleEyesOverlap(base)).toBe(false)
  })
})
