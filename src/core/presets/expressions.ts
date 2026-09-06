import { resolveEyeExpression, type ExpressionModel, type EyeExpression } from '../model'

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
  {
    id: 'expression:sad', name: 'Sad',
    expression: {
      upperLid: 0.05,
      upperLidOuter: 0.22,
      lowerLid: 0.06,
      lowerLidCurvature: 0.12,
      tilt: 6,
      heightScale: 0.92,
    },
  },
  {
    id: 'expression:suspicious', name: 'Suspicious',
    expression: {
      upperLid: 0.08,
      lowerLid: 0.04,
      tilt: 0,
      heightScale: 0.96,
      leftEye: { upperLid: 0.24, upperLidOuter: 0.08, heightScale: 0.78, tilt: 2 },
      rightEye: { upperLid: 0.06, upperLidInner: 0.1, heightScale: 1, tilt: 0 },
    },
  },
  {
    id: 'expression:serious', name: 'Serious',
    expression: { upperLid: 0.18, lowerLid: 0.08, tilt: 0, heightScale: 0.9 },
  },
  {
    id: 'expression:irritated', name: 'Irritated',
    expression: {
      upperLid: 0.08,
      upperLidInner: 0.3,
      upperLidOuter: 0.04,
      lowerLid: 0.08,
      tilt: -2,
      heightScale: 0.86,
    },
  },
]

const expressionKeys: readonly (keyof Required<EyeExpression>)[] = [
  'upperLid',
  'upperLidInner',
  'upperLidOuter',
  'lowerLid',
  'lowerLidCurvature',
  'tilt',
  'heightScale',
  'gazeHeightExpansion',
  'gazeHeightThreshold',
]

function resolvedEyeEqual(
  a: ExpressionModel,
  b: ExpressionModel,
  side: 'left' | 'right',
): boolean {
  const resolvedA = resolveEyeExpression(a, side)
  const resolvedB = resolveEyeExpression(b, side)
  return expressionKeys.every((key) => resolvedA[key] === resolvedB[key])
}

export function matchExpressionPreset(expression: ExpressionModel): string {
  return expressionPresets.find((preset) =>
    resolvedEyeEqual(preset.expression, expression, 'left') &&
    resolvedEyeEqual(preset.expression, expression, 'right'),
  )?.id ?? 'custom'
}
