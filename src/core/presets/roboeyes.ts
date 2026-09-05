import { roboEyesToFaceModel, type RoboEyesParameters } from '../adapters/roboeyes'
import type { FacePreset } from './schema'

export const defaultRoboEyesPreset: Readonly<RoboEyesParameters> = {
  canvasWidth: 128,
  canvasHeight: 64,
  eyeWidth: 36,
  eyeHeight: 36,
  eyeRadius: 8,
  eyeSpacing: 12,
  gazeX: 0,
  gazeY: 0,
  rotation: 0,
  upperLid: 0,
  lowerLid: 0,
  expressionTilt: 0,
  eyeColor: '#ffffff',
  eyeStrokeColor: '#ffffff',
  backgroundColor: '#000000',
}

export const roboEyesPreset: Readonly<FacePreset> = {
  id: 'builtin:roboeyes',
  name: 'RoboEyes',
  version: 1,
  model: roboEyesToFaceModel(defaultRoboEyesPreset),
  constraints: {
    'canvas.width': { min: 16, max: 640, step: 1 },
    'canvas.height': { min: 16, max: 640, step: 1 },
    'eye.width': { min: 1, max: 160, step: 1 },
    'eye.height': { min: 1, max: 160, step: 1 },
    'eye.cornerRadius': { min: 0, max: 80, step: 1 },
    'eye.spacing': { min: 0, max: 160, step: 1 },
    'gaze.x': { min: -64, max: 64, step: 1 },
    'gaze.y': { min: -64, max: 64, step: 1 },
    'eye.rotation': { min: -45, max: 45, step: 1 },
  },
  animationDefaults: {},
  preview: { transparentBackground: false },
}
