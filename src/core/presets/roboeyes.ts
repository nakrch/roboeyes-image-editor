import type { RoboEyesParameters } from '../adapters/roboeyes'

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
