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

  it('smoothly expands only the left outer eye for left gaze', () => {
    const svg = renderFaceToSvg({ ...base, gaze: { x: -24, y: 0 } })
    expect(svg).toContain('data-eye="left" x="2" y="20.8848" width="28" height="22.2304"')
    expect(svg).toContain('data-eye="right" x="50" y="22" width="28" height="20"')
    expect(svg).toContain('data-eye-aperture="left" d="M 2 20.8848 L 30 20.8848 L 30 43.1152 Q 16 43.1152 2 43.1152 Z"')
  })

  it('mirrors the smooth deformation for right gaze and remains deterministic', () => {
    const model = { ...base, gaze: { x: 24, y: 0 } }
    const first = renderFaceToSvg(model)
    const second = renderFaceToSvg(model)
    expect(first).toBe(second)
    expect(first).toContain('data-eye="left" x="50" y="22" width="28" height="20"')
    expect(first).toContain('data-eye="right" x="98" y="20.8848" width="28" height="22.2304"')
    expect(first).toContain('data-eye-aperture="right" d="M 98 20.8848 L 126 20.8848 L 126 43.1152 Q 112 43.1152 98 43.1152 Z"')
  })
})
