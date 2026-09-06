import type { ExpressionModel } from '../model'

export type ExpressionPreset = {
  id: string
  name: string
  expression: ExpressionModel
}

export const expressionPresets: readonly ExpressionPreset[] = [
  {
    id: 'expression:neutral',
    name: 'Neutral',
    expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  },
  {
    id: 'expression:happy',
    name: 'Happy',
    // FluxGarage removes the lower half with a rounded overlay. The normalized
    // lower offset + curvature approximates the same 36px-eye construction.
    expression: {
      upperLid: 0,
      lowerLid: 0.28,
      lowerLidCurvature: 0.44,
      tilt: 0,
    },
  },
  {
    id: 'expression:angry',
    name: 'Angry',
    // Original RoboEyes lowers the inner upper corners by half the eye height.
    expression: {
      upperLid: 0,
      upperLidInner: 0.5,
      upperLidOuter: 0,
      lowerLid: 0,
      tilt: 0,
    },
  },
  {
    id: 'expression:tired',
    name: 'Tired',
    // Original RoboEyes lowers the outer upper corners by half the eye height.
    expression: {
      upperLid: 0,
      upperLidInner: 0,
      upperLidOuter: 0.5,
      lowerLid: 0,
      tilt: 0,
    },
  },
  {
    id: 'expression:surprised',
    name: 'Surprised',
    expression: { upperLid: 0, lowerLid: 0, tilt: 0, heightScale: 1.22 },
  },
]

function normalizedHeightScale(expression: ExpressionModel): number {
  return expression.heightScale ?? 1
}

function normalizedUpperInner(expression: ExpressionModel): number {
  return expression.upperLidInner ?? expression.upperLid
}

function normalizedUpperOuter(expression: ExpressionModel): number {
  return expression.upperLidOuter ?? expression.upperLid
}

function normalizedLowerCurvature(expression: ExpressionModel): number {
  return expression.lowerLidCurvature ?? 0
}

export function matchExpressionPreset(expression: ExpressionModel): string {
  if (expression.leftEye || expression.rightEye) return 'custom'
  return expressionPresets.find((preset) =>
    preset.expression.upperLid === expression.upperLid &&
    normalizedUpperInner(preset.expression) === normalizedUpperInner(expression) &&
    normalizedUpperOuter(preset.expression) === normalizedUpperOuter(expression) &&
    preset.expression.lowerLid === expression.lowerLid &&
    normalizedLowerCurvature(preset.expression) === normalizedLowerCurvature(expression) &&
    preset.expression.tilt === expression.tilt &&
    normalizedHeightScale(preset.expression) === normalizedHeightScale(expression),
  )?.id ?? 'custom'
}
