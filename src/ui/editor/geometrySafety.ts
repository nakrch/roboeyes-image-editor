import { isGazeCanvasSafe, type EyeExpression, type FaceModel } from '../../core/model'

export type ExpressionGeometryKey = 'tilt' | 'heightScale'
export type ValueRange = { min: number; max: number }

const REFINE_STEPS = 18
const SPACING_MIN = 0
const SPACING_MAX = 160
const TILT_MIN = -30
const TILT_MAX = 30
const HEIGHT_SCALE_MIN = 0.5
const HEIGHT_SCALE_MAX = 1.5

function pairAxis(model: FaceModel): { x: number; y: number } {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  const dx = right.x - left.x
  const dy = right.y - left.y
  const length = Math.hypot(dx, dy)
  return length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }
}

export function anchoredPairSpacing(model: FaceModel): number {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const centerDistance = Math.hypot(
    right.position.x - left.position.x,
    right.position.y - left.position.y,
  )
  return centerDistance - (left.width + right.width) / 2
}

export function setAnchoredPairSpacing(model: FaceModel, spacing: number): FaceModel {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const center = {
    x: (left.position.x + right.position.x) / 2,
    y: (left.position.y + right.position.y) / 2,
  }
  const axis = pairAxis(model)
  const distance = left.width / 2 + Math.max(0, spacing) + right.width / 2
  const half = distance / 2

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...left,
        position: { x: center.x - axis.x * half, y: center.y - axis.y * half },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...right,
        position: { x: center.x + axis.x * half, y: center.y + axis.y * half },
      },
    },
  }
}

function safeUpperBound(
  current: number,
  maximum: number,
  apply: (value: number) => FaceModel,
): number {
  if (isGazeCanvasSafe(apply(maximum))) return maximum
  let safe = current
  let unsafe = maximum
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (isGazeCanvasSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

function safeLowerBound(
  current: number,
  minimum: number,
  apply: (value: number) => FaceModel,
): number {
  if (isGazeCanvasSafe(apply(minimum))) return minimum
  let safe = current
  let unsafe = minimum
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (isGazeCanvasSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

export function anchoredPairSpacingMax(model: FaceModel): number {
  const current = Math.max(SPACING_MIN, anchoredPairSpacing(model))
  return safeUpperBound(current, SPACING_MAX, (value) => setAnchoredPairSpacing(model, value))
}

export function setAnchoredPairSpacingSafely(model: FaceModel, spacing: number): FaceModel {
  const maximum = anchoredPairSpacingMax(model)
  return setAnchoredPairSpacing(model, Math.min(maximum, Math.max(SPACING_MIN, spacing)))
}

function sharedExpressionValue(model: FaceModel, key: ExpressionGeometryKey): number {
  return key === 'heightScale' ? model.expression.heightScale ?? 1 : model.expression.tilt
}

function applySharedExpressionValue(
  model: FaceModel,
  key: ExpressionGeometryKey,
  value: number,
): FaceModel {
  return {
    ...model,
    expression: {
      ...model.expression,
      [key]: value,
      leftEye: undefined,
      rightEye: undefined,
    },
  }
}

function applySideExpressionValue(
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

function expressionDomain(key: ExpressionGeometryKey): ValueRange {
  return key === 'tilt'
    ? { min: TILT_MIN, max: TILT_MAX }
    : { min: HEIGHT_SCALE_MIN, max: HEIGHT_SCALE_MAX }
}

function safeExpressionRange(
  current: number,
  domain: ValueRange,
  apply: (value: number) => FaceModel,
): ValueRange {
  return {
    min: safeLowerBound(current, domain.min, apply),
    max: safeUpperBound(current, domain.max, apply),
  }
}

export function sharedExpressionGeometryRange(
  model: FaceModel,
  key: ExpressionGeometryKey,
): ValueRange {
  const current = sharedExpressionValue(model, key)
  return safeExpressionRange(current, expressionDomain(key), (value) =>
    applySharedExpressionValue(model, key, value),
  )
}

export function sideExpressionGeometryRange(
  model: FaceModel,
  side: 'left' | 'right',
  key: ExpressionGeometryKey,
): ValueRange {
  const expression = side === 'left' ? model.expression.leftEye : model.expression.rightEye
  const resolved = key === 'heightScale'
    ? expression?.heightScale ?? model.expression.heightScale ?? 1
    : expression?.tilt ?? model.expression.tilt
  return safeExpressionRange(resolved, expressionDomain(key), (value) =>
    applySideExpressionValue(model, side, key, value),
  )
}

export function setSharedExpressionGeometrySafely(
  model: FaceModel,
  key: ExpressionGeometryKey,
  value: number,
): FaceModel {
  const range = sharedExpressionGeometryRange(model, key)
  const safe = Math.min(range.max, Math.max(range.min, value))
  return applySharedExpressionValue(model, key, safe)
}

export function setSideExpressionGeometrySafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: ExpressionGeometryKey,
  value: number,
): FaceModel {
  const range = sideExpressionGeometryRange(model, side, key)
  const safe = Math.min(range.max, Math.max(range.min, value))
  return applySideExpressionValue(model, side, key, safe)
}

export function isExpressionGeometryKey(key: keyof EyeExpression): key is ExpressionGeometryKey {
  return key === 'tilt' || key === 'heightScale'
}
