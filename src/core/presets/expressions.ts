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
    expression: { upperLid: 0.05, lowerLid: 0.32, tilt: -10 },
  },
  {
    id: 'expression:angry',
    name: 'Angry',
    expression: { upperLid: 0.24, lowerLid: 0, tilt: 14 },
  },
  {
    id: 'expression:tired',
    name: 'Tired',
    expression: { upperLid: 0.46, lowerLid: 0.08, tilt: 0 },
  },
  {
    id: 'expression:surprised',
    name: 'Surprised',
    expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  },
]

export function matchExpressionPreset(expression: ExpressionModel): string {
  if (expression.leftEye || expression.rightEye) return 'custom'
  return expressionPresets.find((preset) =>
    preset.expression.upperLid === expression.upperLid &&
    preset.expression.lowerLid === expression.lowerLid &&
    preset.expression.tilt === expression.tilt,
  )?.id ?? 'custom'
}
