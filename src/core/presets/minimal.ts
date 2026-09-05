import type { FacePreset } from './schema'

export const minimalPreset: Readonly<FacePreset> = {
  id: 'builtin:minimal',
  name: 'Minimal',
  version: 1,
  model: {
    canvas: { width: 128, height: 64 },
    leftEye: {
      geometry: {
        position: { x: 42, y: 32 },
        width: 28,
        height: 18,
        cornerRadius: 9,
        rotation: 0,
      },
    },
    rightEye: {
      geometry: {
        position: { x: 86, y: 32 },
        width: 28,
        height: 18,
        cornerRadius: 9,
        rotation: 0,
      },
    },
    gaze: { x: 0, y: 0 },
    expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
    colors: { eye: '#ffffff', stroke: '#ffffff', background: '#000000' },
  },
  constraints: {
    'canvas.width': { min: 16, max: 640, step: 1 },
    'canvas.height': { min: 16, max: 640, step: 1 },
    'eye.width': { min: 1, max: 160, step: 1 },
    'eye.height': { min: 1, max: 160, step: 1 },
    'eye.cornerRadius': { min: 0, max: 80, step: 1 },
  },
  animationDefaults: {},
  preview: { transparentBackground: false },
}
