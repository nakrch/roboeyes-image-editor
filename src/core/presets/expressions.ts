import type { ExpressionModel } from '../model'

export type ExpressionPreset = {
  id: string
  name: string
  expression: ExpressionModel
}

export const expressionPresets: readonly ExpressionPreset[] = [
  { id: 'expression:neutral', name: 'Neutral', expression: { upperLid: 0, lowerLid: 0, tilt: 0 } },
  {
    id: 'expression:happy', name: 'Happy',
    expression: { upperLid: 0, lowerLid: 0.28, lowerLidCurvature: 0.44, tilt: 0 },
  },
  {
    id: 'expression:angry', name: 'Angry',
    expression: { upperLid: 0, upperLidInner: 0.5, upperLidOuter: 0, lowerLid: 0, tilt: 0 },
  },
  {
    id: 'expression:tired', name: 'Tired',
    expression: { upperLid: 0, upperLidInner: 0, upperLidOuter: 0.5, lowerLid: 0, tilt: 0 },
  },
  {
    id: 'expression:curious', name: 'Curious',
    expression: { upperLid: 0, lowerLid: 0, tilt: 0, gazeHeightExpansion: 0.35, gazeHeightThreshold: 0.12 },
  },
  {
    id: 'expression:surprised', name: 'Surprised',
    expression: { upperLid: 0, lowerLid: 0, tilt: 0, heightScale: 1.22 },
  },
]

const normalizedHeightScale = (expression: ExpressionModel) => expression.heightScale ?? 1
const normalizedUpperInner = (expression: ExpressionModel) => expression.upperLidInner ?? expression.upperLid
const normalizedUpperOuter = (expression: ExpressionModel) => expression.upperLidOuter ?? expression.upperLid
const normalizedLowerCurvature = (expression: ExpressionModel) => expression.lowerLidCurvature ?? 0
const normalizedGazeExpansion = (expression: ExpressionModel) => expression.gazeHeightExpansion ?? 0
const normalizedGazeThreshold = (expression: ExpressionModel) => expression.gazeHeightThreshold ?? 0.15

export function matchExpressionPreset(expression: ExpressionModel): string {
  if (expression.leftEye || expression.rightEye) return 'custom'
  return expressionPresets.find((preset) =>
    preset.expression.upperLid === expression.upperLid &&
    normalizedUpperInner(preset.expression) === normalizedUpperInner(expression) &&
    normalizedUpperOuter(preset.expression) === normalizedUpperOuter(expression) &&
    preset.expression.lowerLid === expression.lowerLid &&
    normalizedLowerCurvature(preset.expression) === normalizedLowerCurvature(expression) &&
    preset.expression.tilt === expression.tilt &&
    normalizedHeightScale(preset.expression) === normalizedHeightScale(expression) &&
    normalizedGazeExpansion(preset.expression) === normalizedGazeExpansion(expression) &&
    normalizedGazeThreshold(preset.expression) === normalizedGazeThreshold(expression),
  )?.id ?? 'custom'
}
