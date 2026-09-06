import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  resolveEyeExpression,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import {
  setSideLidSafely,
  type ExpressionGeometryKey,
  type LidKey,
  type ValueRange,
} from './geometrySafety'

const REFINE_STEPS = 24
const SCAN_STEPS = 320
const TILT_RANGE: ValueRange = { min: -30, max: 30 }
const HEIGHT_SCALE_RANGE: ValueRange = { min: 0.5, max: 1.5 }

function domain(key: ExpressionGeometryKey): ValueRange {
  return key === 'tilt' ? TILT_RANGE : HEIGHT_SCALE_RANGE
}

function applySideValue(
  model: FaceModel,
  side: 'left' | 'right',
  key: ExpressionGeometryKey,
  value: number,
): FaceModel {
  const property = side === 'left' ? 'leftEye' : 'rightEye'
  return {
    ...model,
    expression: {
      ...model.expression,
      [property]: { ...model.expression[property], [key]: value },
    },
  }
}

function isCandidateSafe(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

function refineBoundary(
  safeValue: number,
  unsafeValue: number,
  apply: (value: number) => FaceModel,
): number {
  let safe = safeValue
  let unsafe = unsafeValue
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (isCandidateSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

function scanBoundary(
  anchor: number,
  endpoint: number,
  apply: (value: number) => FaceModel,
): number {
  if (anchor === endpoint) return anchor
  let previous = anchor
  for (let index = 1; index <= SCAN_STEPS; index += 1) {
    const candidate = anchor + (endpoint - anchor) * (index / SCAN_STEPS)
    if (!isCandidateSafe(apply(candidate))) {
      return refineBoundary(previous, candidate, apply)
    }
    previous = candidate
  }
  return endpoint
}

function findAnchor(
  current: number,
  range: ValueRange,
  apply: (value: number) => FaceModel,
): number | undefined {
  const clamped = Math.min(range.max, Math.max(range.min, current))
  if (isCandidateSafe(apply(clamped))) return clamped

  let best: number | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index <= SCAN_STEPS; index += 1) {
    const candidate = range.min + (range.max - range.min) * (index / SCAN_STEPS)
    if (!isCandidateSafe(apply(candidate))) continue
    const distance = Math.abs(candidate - clamped)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function independentExpressionGeometryRange(
  model: FaceModel,
  side: 'left' | 'right',
  key: ExpressionGeometryKey,
): ValueRange {
  const resolved = resolveEyeExpression(model.expression, side)
  const current = key === 'heightScale' ? resolved.heightScale : resolved.tilt
  const range = domain(key)
  const apply = (value: number) => applySideValue(model, side, key, value)
  const anchor = findAnchor(current, range, apply)
  if (anchor === undefined) return { min: current, max: current }

  return {
    min: scanBoundary(anchor, range.min, apply),
    max: scanBoundary(anchor, range.max, apply),
  }
}

export function setIndependentExpressionGeometrySafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: ExpressionGeometryKey,
  value: number,
): FaceModel {
  const range = independentExpressionGeometryRange(model, side, key)
  const safe = Math.min(range.max, Math.max(range.min, value))
  const next = applySideValue(model, side, key, safe)
  return isCandidateSafe(next) ? next : model
}

export function setIndependentLidSafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: LidKey,
  value: number,
): FaceModel {
  const resolved = resolveEyeExpression(model.expression, side)
  const current = resolved[key]
  const target = Math.min(1, Math.max(0, value))
  const apply = (candidate: number) => setSideLidSafely(model, side, key, candidate)

  const requested = apply(target)
  if (isCandidateSafe(requested)) return requested
  if (!isCandidateSafe(model)) return model

  let safeValue = current
  let unsafeValue = target
  let safeModel = model
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safeValue + unsafeValue) / 2
    const candidate = apply(midpoint)
    if (isCandidateSafe(candidate)) {
      safeValue = midpoint
      safeModel = candidate
    } else {
      unsafeValue = midpoint
    }
  }

  return safeModel
}
