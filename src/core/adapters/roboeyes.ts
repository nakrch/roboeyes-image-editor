import type { EyeGeometry, FaceModel } from '../model'

export type RoboEyesEyeOverrides = Partial<
  Pick<EyeGeometry, 'width' | 'height' | 'cornerRadius' | 'rotation'>
>

export type RoboEyesParameters = {
  canvasWidth: number
  canvasHeight: number
  eyeWidth: number
  eyeHeight: number
  eyeRadius: number
  /** Empty space between the inside edges of the two eyes. */
  eyeSpacing: number
  /** Center point of the eye pair. Defaults to the canvas center. */
  centerX?: number
  centerY?: number
  gazeX: number
  gazeY: number
  rotation: number
  upperLid: number
  lowerLid: number
  expressionTilt: number
  eyeColor: string
  backgroundColor: string
  leftEye?: RoboEyesEyeOverrides
  rightEye?: RoboEyesEyeOverrides
}

function eyeGeometry(
  x: number,
  y: number,
  parameters: RoboEyesParameters,
  overrides: RoboEyesEyeOverrides | undefined,
): EyeGeometry {
  return {
    position: { x, y },
    width: overrides?.width ?? parameters.eyeWidth,
    height: overrides?.height ?? parameters.eyeHeight,
    cornerRadius: overrides?.cornerRadius ?? parameters.eyeRadius,
    rotation: overrides?.rotation ?? parameters.rotation,
  }
}

export function roboEyesToFaceModel(parameters: RoboEyesParameters): FaceModel {
  const centerX = parameters.centerX ?? parameters.canvasWidth / 2
  const centerY = parameters.centerY ?? parameters.canvasHeight / 2

  const leftWidth = parameters.leftEye?.width ?? parameters.eyeWidth
  const rightWidth = parameters.rightEye?.width ?? parameters.eyeWidth

  // eyeSpacing is edge-to-edge. Derive each center from the pair center so
  // asymmetric widths remain correctly separated around the requested center.
  const pairWidth = leftWidth + parameters.eyeSpacing + rightWidth
  const leftX = centerX - pairWidth / 2 + leftWidth / 2
  const rightX = centerX + pairWidth / 2 - rightWidth / 2

  return {
    canvas: {
      width: parameters.canvasWidth,
      height: parameters.canvasHeight,
    },
    leftEye: {
      geometry: eyeGeometry(leftX, centerY, parameters, parameters.leftEye),
    },
    rightEye: {
      geometry: eyeGeometry(rightX, centerY, parameters, parameters.rightEye),
    },
    gaze: {
      x: parameters.gazeX,
      y: parameters.gazeY,
    },
    expression: {
      upperLid: parameters.upperLid,
      lowerLid: parameters.lowerLid,
      tilt: parameters.expressionTilt,
    },
    colors: {
      eye: parameters.eyeColor,
      background: parameters.backgroundColor,
    },
  }
}
