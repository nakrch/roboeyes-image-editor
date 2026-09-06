import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from './index'

const base: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 40, y: 32 }, width: 28, height: 20, cornerRadius: 8, rotation: 0 } },
  rightEye: { geometry: { position: { x: 88, y: 32 }, width: 28, height: 20, cornerRadius: 8, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: {
    upperLid: 0,
    lowerLid: 0,
    tilt: 0,
    gazeHeightExpansion: 0.5,
    gazeHeightThreshold: 0.1,
  },
  colors: { eye: '#ffffff', background: '#000000' },
}

describe('gaze-reactive curious SVG fixtures', () => {
  it('keeps both eyes at base height at center gaze', () => {
    const svg = renderFaceToSvg(base)
    expect(svg).toContain('data-eye="left" x="26" y="22" width="28" height="20"')
    expect(svg).toContain('data-eye="right" x="74" y="22" width="28" height="20"')
  })

  it('expands only the left outer eye for left gaze', () => {
    const svg = renderFaceToSvg({ ...base, gaze: { x: -8, y: 0 } })
    expect(svg).toContain('data-eye="left" x="18" y="17" width="28" height="30"')
    expect(svg).toContain('data-eye="right" x="66" y="22" width="28" height="20"')
    expect(svg).toContain('data-eye-aperture="left" d="M 18 17 L 46 17 L 46 47 Q 32 47 18 47 Z"')
  })

  it('mirrors the deformation for right gaze and remains deterministic', () => {
    const model = { ...base, gaze: { x: 8, y: 0 } }
    const first = renderFaceToSvg(model)
    const second = renderFaceToSvg(model)
    expect(first).toBe(second)
    expect(first).toContain('data-eye="left" x="34" y="22" width="28" height="20"')
    expect(first).toContain('data-eye="right" x="82" y="17" width="28" height="30"')
    expect(first).toContain('data-eye-aperture="right" d="M 82 17 L 110 17 L 110 47 Q 96 47 82 47 Z"')
  })
})
