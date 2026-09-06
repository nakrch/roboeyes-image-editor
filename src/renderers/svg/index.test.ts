import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { renderFaceToSvg } from './index'

const model: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: {
    geometry: {
      position: { x: 40, y: 32 },
      width: 32,
      height: 28,
      cornerRadius: 6,
      rotation: -4,
    },
  },
  rightEye: {
    geometry: {
      position: { x: 88, y: 32 },
      width: 36,
      height: 30,
      cornerRadius: 8,
      rotation: 4,
    },
  },
  gaze: { x: 2, y: -1 },
  expression: { upperLid: 0.25, lowerLid: 0.1, tilt: 3 },
  colors: { eye: '#ffffff', stroke: '#00ffff', background: '#000000' },
}

describe('renderFaceToSvg', () => {
  it('honors exact canvas dimensions and renders both eyes', () => {
    const svg = renderFaceToSvg(model)

    expect(svg).toContain('width="128" height="64" viewBox="0 0 128 64"')
    expect(svg).toContain('data-eye="left"')
    expect(svg).toContain('data-eye="right"')
    expect(svg).toContain('stroke="#00ffff" stroke-width="1"')
    expect(svg).toContain('data-background="true"')
  })

  it('supports transparent background', () => {
    const svg = renderFaceToSvg(model, { transparentBackground: true })

    expect(svg).not.toContain('data-background="true"')
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
  })

  it('applies gaze and expression transforms deterministically', () => {
    const first = renderFaceToSvg(model)
    const second = renderFaceToSvg(model)

    expect(first).toBe(second)
    expect(first).toContain('x="26" y="17"')
    expect(first).toContain('transform="rotate(-7 42 31)"')
    expect(first).toContain('transform="rotate(7 90 31)"')
  })

  it('renders mirrored directional upper lids and a curved lower aperture', () => {
    const svg = renderFaceToSvg({
      ...model,
      expression: {
        upperLid: 0,
        upperLidInner: 0.6,
        upperLidOuter: 0.2,
        lowerLid: 0.15,
        lowerLidCurvature: 0.7,
        tilt: 0,
      },
    })

    const leftPath = svg.match(/data-eye-aperture="left" d="([^"]+)"/)?.[1]
    const rightPath = svg.match(/data-eye-aperture="right" d="([^"]+)"/)?.[1]

    expect(leftPath).toContain('M 26 22.6 L 58 33.8')
    expect(rightPath).toContain('M 72 34 L 108 22')
    expect(leftPath).toContain('Q 42 28.2 26 42.8')
    expect(rightPath).toContain('Q 90 28 72 43.5')
  })
})
