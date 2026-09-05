export type EyeExpression = {
  /** 0 = fully open, 1 = fully closed from the upper lid. */
  upperLid: number
  /** 0 = fully open, 1 = fully closed from the lower lid. */
  lowerLid: number
  /** Generic mirrored expression tilt in degrees. */
  tilt: number
}

export type ExpressionModel = EyeExpression & {
  /** Optional per-eye overrides. Unspecified values inherit the shared expression. */
  leftEye?: Partial<EyeExpression>
  rightEye?: Partial<EyeExpression>
}

export function resolveEyeExpression(
  expression: ExpressionModel,
  side: 'left' | 'right',
): EyeExpression {
  const override = side === 'left' ? expression.leftEye : expression.rightEye
  return {
    upperLid: override?.upperLid ?? expression.upperLid,
    lowerLid: override?.lowerLid ?? expression.lowerLid,
    tilt: override?.tilt ?? expression.tilt,
  }
}
