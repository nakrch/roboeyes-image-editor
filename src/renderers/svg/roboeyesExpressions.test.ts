import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../../core/model'
import { expressionPresets } from '../../core/presets'
import { renderFaceToSvg } from './index'

const referenceModel: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: {
    geometry: {
      position: { x: 40, y: 32 },
      width: 36,
      height: 36,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  rightEye: {
    geometry: {
      position: { x: 88, y: 32 },
      width: 30,
      height: 36,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#ffffff', stroke: '#ffffff', background: '#000000' },
}

function fixture(name: 'Happy' | 'Tired' | 'Angry') {
  const expression = expressionPresets.find((preset) => preset.name === name)!.expression
  const svg = renderFaceToSvg({ ...referenceModel, expression })
  return {
    left: svg.match(/data-eye-aperture="left" d="([^"]+)"/)?.[1],
    right: svg.match(/data-eye-aperture="right" d="([^"]+)"/)?.[1],
  }
}

describe('RoboEyes expression SVG fixtures', () => {
  it('Happy uses a centered rounded lower cut at 128x64 reference scale', () => {
    expect(fixture('Happy')).toEqual({
      left: 'M 22 14 L 58 14 L 58 39.92 Q 40 32 22 39.92 Z',
      right: 'M 73 14 L 103 14 L 103 39.92 Q 88 32 73 39.92 Z',
    })
  })

  it('Tired lowers the physical outer corners, including unequal eye widths', () => {
    expect(fixture('Tired')).toEqual({
      left: 'M 22 32 L 58 14 L 58 50 Q 40 50 22 50 Z',
      right: 'M 73 14 L 103 32 L 103 50 Q 88 50 73 50 Z',
    })
  })

  it('Angry lowers the physical inner corners, including unequal eye widths', () => {
    expect(fixture('Angry')).toEqual({
      left: 'M 22 14 L 58 32 L 58 50 Q 40 50 22 50 Z',
      right: 'M 73 32 L 103 14 L 103 50 Q 88 50 73 50 Z',
    })
  })
})
