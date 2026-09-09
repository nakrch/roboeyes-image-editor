import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from './index'

const model: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 64, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  rightEye: { geometry: { position: { x: 112, y: 32 }, width: 36, height: 28, cornerRadius: 7, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#fff', background: '#000' },
}

describe('single-eye SVG rendering', () => {
  it('keeps the legacy two-eye output path when visibility is omitted', () => {
    const svg = renderFaceToSvg(model)
    expect(svg).toContain('data-eye="left"')
    expect(svg).toContain('data-eye="right"')
    expect(svg).toContain('eye-clip-left')
    expect(svg).toContain('eye-clip-right')
  })

  it('omits the hidden eye and its clip definition deterministically', () => {
    const single: FaceModel = {
      ...model,
      eyeVisibility: { left: true, right: false },
    }
    const first = renderFaceToSvg(single)
    const second = renderFaceToSvg(structuredClone(single))

    expect(first).toBe(second)
    expect(first).toContain('data-eye="left"')
    expect(first).not.toContain('data-eye="right"')
    expect(first).toContain('eye-clip-left')
    expect(first).not.toContain('eye-clip-right')
  })
})
