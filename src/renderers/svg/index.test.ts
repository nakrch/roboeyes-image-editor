import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { expressionPresets, roboEyesPreset } from '../../core/presets'
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
    expect(leftPath).toContain('Q 42 31 26 40.8')
    expect(rightPath).toContain('Q 90 31 72 41.5')
  })

  it('keeps upper lid active after directional offsets are set', () => {
    const svg = renderFaceToSvg({
      ...model,
      gaze: { x: 0, y: 0 },
      expression: {
        upperLid: 0.2,
        upperLidInner: 0.3,
        upperLidOuter: 0.1,
        lowerLid: 0,
        tilt: 0,
      },
    })

    const leftPath = svg.match(/data-eye-aperture="left" d="([^"]+)"/)?.[1]
    expect(leftPath).toContain('M 24 26.4 L 56 32')
  })

  it('clamps invalid upper/lower combinations to a non-inverting edge', () => {
    const svg = renderFaceToSvg({
      ...model,
      gaze: { x: 0, y: 0 },
      expression: {
        upperLid: 0.2,
        upperLidOuter: 0.9,
        lowerLid: 0.3,
        lowerLidCurvature: 0.4,
        tilt: 0,
      },
    })

    const leftPath = svg.match(/data-eye-aperture="left" d="([^"]+)"/)?.[1]
    expect(leftPath).toContain('M 24 37.6')
    expect(leftPath).toContain('L 56 23.6')
    expect(leftPath).toContain('L 56 37.6')
  })

  it('renders derivative-inspired static presets deterministically at 128x64', () => {
    const expectedPaths: Record<string, { left: string; right: string }> = {
      Sad: {
        left: 'M 22 24.3824 L 58 17.096 L 58 46.5728 Q 40 44.5856 22 46.5728 Z',
        right: 'M 70 17.096 L 106 24.3824 L 106 46.5728 Q 88 44.5856 70 46.5728 Z',
      },
      Suspicious: {
        left: 'M 22 26.9456 L 58 24.6992 L 58 44.9168 Q 40 44.9168 22 44.9168 Z',
        right: 'M 70 19.76 L 106 16.16 L 106 48.56 Q 88 48.56 70 48.56 Z',
      },
      Serious: {
        left: 'M 22 21.632 L 58 21.632 L 58 45.608 Q 40 45.608 22 45.608 Z',
        right: 'M 70 21.632 L 106 21.632 L 106 45.608 Q 88 45.608 70 45.608 Z',
      },
      Irritated: {
        left: 'M 22 20.2352 L 58 28.2848 L 58 45.0032 Q 40 45.0032 22 45.0032 Z',
        right: 'M 70 28.2848 L 106 20.2352 L 106 45.0032 Q 88 45.0032 70 45.0032 Z',
      },
    }

    const outputs = Object.entries(expectedPaths).map(([name, expected]) => {
      const preset = expressionPresets.find((item) => item.name === name)!
      const face: FaceModel = {
        ...structuredClone(roboEyesPreset.model),
        expression: structuredClone(preset.expression),
      }
      const first = renderFaceToSvg(face)
      const second = renderFaceToSvg(face)
      const leftPath = first.match(/data-eye-aperture="left" d="([^"]+)"/)?.[1]
      const rightPath = first.match(/data-eye-aperture="right" d="([^"]+)"/)?.[1]

      expect(first).toBe(second)
      expect(first).toContain('width="128" height="64" viewBox="0 0 128 64"')
      expect(leftPath).toBe(expected.left)
      expect(rightPath).toBe(expected.right)
      return first
    })

    expect(new Set(outputs).size).toBe(outputs.length)
  })
})
