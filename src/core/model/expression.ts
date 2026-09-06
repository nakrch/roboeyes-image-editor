export type EyeExpression = {
  /** 0 = fully open, 1 = fully closed from the upper lid. */
  upperLid: number
  /** Optional directional upper-lid depth at the eye's inner edge. Falls back to upperLid. */
  upperLidInner?: number
  /** Optional directional upper-lid depth at the eye's outer edge. Falls back to upperLid. */
  upperLidOuter?: number
  /** 0 = fully open, 1 = fully closed from the lower lid. */
  lowerLid: number
  /** 0 = straight lower aperture, 1 = maximally rounded/raised center cut. */
  lowerLidCurvature?: number
  /** Generic mirrored expression tilt in degrees. */
  tilt: number
  /** Vertical eye shape multiplier. Defaults to 1 for backward compatibility. */
  heightScale?: number
  /** Additional height multiplier applied to the eye on the active horizontal gaze side. */
  gazeHeightExpansion?: number
  /** Horizontal gaze threshold as a fraction of half the canvas width. */
  gazeHeightThreshold?: number
}

export type ExpressionModel = EyeExpression & {
  /** Optional per-eye overrides. Unspecified values inherit the shared expression. */
  leftEye?: Partial<EyeExpression>
  rightEye?: Partial<EyeExpression>
}

export function resolveEyeExpression(
  expression: ExpressionModel,
  side: 'left' | 'right',
): Required<EyeExpression> {
  const override = side === 'left' ? expression.leftEye : expression.rightEye
  const upperLid = override?.upperLid ?? expression.upperLid
  const lowerLid = override?.lowerLid ?? expression.lowerLid

  return {
    upperLid,
    upperLidInner: override?.upperLidInner ?? expression.upperLidInner ?? upperLid,
    upperLidOuter: override?.upperLidOuter ?? expression.upperLidOuter ?? upperLid,
    lowerLid,
    lowerLidCurvature: override?.lowerLidCurvature ?? expression.lowerLidCurvature ?? 0,
    tilt: override?.tilt ?? expression.tilt,
    heightScale: override?.heightScale ?? expression.heightScale ?? 1,
    gazeHeightExpansion: override?.gazeHeightExpansion ?? expression.gazeHeightExpansion ?? 0,
    gazeHeightThreshold: override?.gazeHeightThreshold ?? expression.gazeHeightThreshold ?? 0.15,
  }
}

export function resolveGazeReactiveHeightScale(
  expression: ExpressionModel,
  side: 'left' | 'right',
  gazeX: number,
  canvasWidth: number,
): number {
  const resolved = resolveEyeExpression(expression, side)
  const halfWidth = Math.max(1e-9, Math.abs(canvasWidth) / 2)
  const normalizedMagnitude = Math.abs(gazeX) / halfWidth
  const threshold = Math.min(1, Math.max(0, resolved.gazeHeightThreshold))
  const pointsToSide = side === 'left' ? gazeX < 0 : gazeX > 0
  const active = pointsToSide && normalizedMagnitude >= threshold
  const expansion = active ? Math.max(0, resolved.gazeHeightExpansion) : 0
  return Math.max(0, resolved.heightScale) * (1 + expansion)
}
