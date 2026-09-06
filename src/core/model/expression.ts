export type EyeExpression = {
  /** 0 = fully open, 1 = fully closed from the upper lid. */
  upperLid: number
  /** Optional additional upper-lid mask depth at the eye's inner edge. Defaults to 0. */
  upperLidInner?: number
  /** Optional additional upper-lid mask depth at the eye's outer edge. Defaults to 0. */
  upperLidOuter?: number
  /** 0 = fully open, 1 = fully closed from the lower lid. */
  lowerLid: number
  /** 0 = straight lower aperture, 1 = maximally rounded/raised center cut. */
  lowerLidCurvature?: number
  /** Generic mirrored expression tilt in degrees. */
  tilt: number
  /** Vertical eye shape multiplier. Defaults to 1 for backward compatibility. */
  heightScale?: number
  /** Maximum additional height multiplier on the active horizontal gaze side. */
  gazeHeightExpansion?: number
  /** Horizontal gaze magnitude where the height ramp begins, as a fraction of half the canvas width. */
  gazeHeightThreshold?: number
}

export type ExpressionModel = EyeExpression & {
  /** Optional per-eye overrides. Unspecified values inherit the shared expression. */
  leftEye?: Partial<EyeExpression>
  rightEye?: Partial<EyeExpression>
}

export type EyeLidAperture = {
  /** Normalized top boundary at the physical left edge, after safe clamping. */
  upperLeft: number
  /** Normalized top boundary at the physical right edge, after safe clamping. */
  upperRight: number
  /** Normalized straight lower boundary. */
  lower: number
  /** Normalized quadratic lower-curve control point. */
  lowerMid: number
  /** Whether the requested upper/lower masks do not cross before renderer clamping. */
  valid: boolean
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export function resolveEyeExpression(
  expression: ExpressionModel,
  side: 'left' | 'right',
): Required<EyeExpression> {
  const override = side === 'left' ? expression.leftEye : expression.rightEye
  const upperLid = override?.upperLid ?? expression.upperLid
  const lowerLid = override?.lowerLid ?? expression.lowerLid

  return {
    upperLid,
    upperLidInner: override?.upperLidInner ?? expression.upperLidInner ?? 0,
    upperLidOuter: override?.upperLidOuter ?? expression.upperLidOuter ?? 0,
    lowerLid,
    lowerLidCurvature: override?.lowerLidCurvature ?? expression.lowerLidCurvature ?? 0,
    tilt: override?.tilt ?? expression.tilt,
    heightScale: override?.heightScale ?? expression.heightScale ?? 1,
    gazeHeightExpansion: override?.gazeHeightExpansion ?? expression.gazeHeightExpansion ?? 0,
    gazeHeightThreshold: override?.gazeHeightThreshold ?? expression.gazeHeightThreshold ?? 0.15,
  }
}

/**
 * Resolve the visible aperture from generic lid parameters.
 * Directional upper-lid fields are additive mask offsets on top of `upperLid`,
 * mirroring RoboEyes' base-eye + overlay construction.
 */
export function resolveEyeLidAperture(
  expression: ExpressionModel,
  side: 'left' | 'right',
): EyeLidAperture {
  const resolved = resolveEyeExpression(expression, side)
  const baseUpper = clamp01(resolved.upperLid)
  const rawInner = baseUpper + clamp01(resolved.upperLidInner)
  const rawOuter = baseUpper + clamp01(resolved.upperLidOuter)
  const lowerDepth = clamp01(resolved.lowerLid)
  const lower = 1 - lowerDepth
  const valid = rawInner <= lower + 1e-9 && rawOuter <= lower + 1e-9
  const inner = Math.min(rawInner, lower)
  const outer = Math.min(rawOuter, lower)
  const upperLeft = side === 'left' ? outer : inner
  const upperRight = side === 'left' ? inner : outer
  const upperMid = (upperLeft + upperRight) / 2
  const lowerMid = Math.max(upperMid, lower - 0.5 * clamp01(resolved.lowerLidCurvature))

  return { upperLeft, upperRight, lower, lowerMid, valid }
}

export function areEyeLidAperturesValid(expression: ExpressionModel): boolean {
  return resolveEyeLidAperture(expression, 'left').valid &&
    resolveEyeLidAperture(expression, 'right').valid
}

function smoothstep01(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function resolveGazeReactiveHeightScale(
  expression: ExpressionModel,
  side: 'left' | 'right',
  gazeX: number,
  canvasWidth: number,
): number {
  const resolved = resolveEyeExpression(expression, side)
  const halfWidth = Math.max(1e-9, Math.abs(canvasWidth) / 2)
  const normalizedMagnitude = Math.min(1, Math.abs(gazeX) / halfWidth)
  const threshold = Math.min(1, Math.max(0, resolved.gazeHeightThreshold))
  const pointsToSide = side === 'left' ? gazeX < 0 : gazeX > 0
  const denominator = Math.max(1e-9, 1 - threshold)
  const progress = pointsToSide
    ? smoothstep01((normalizedMagnitude - threshold) / denominator)
    : 0
  const expansion = Math.max(0, resolved.gazeHeightExpansion) * progress
  return Math.max(0, resolved.heightScale) * (1 + expansion)
}
