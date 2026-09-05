import {
  canFitEyesInCanvas,
  clampGaze,
  isGazeCanvasSafe,
  visibleEyesOverlap,
  type EyeExpression,
  type FaceModel,
} from '../../core/model'

export type ExpressionGeometryKey = 'tilt' | 'heightScale'
export type LidKey = 'upperLid' | 'lowerLid'
export type ValueRange = { min: number; max: number }

const REFINE_STEPS = 18
const SPACING_MIN = 0
const SPACING_MAX = 160
const TILT_MIN = -30
const TILT_MAX = 30
const HEIGHT_SCALE_MIN = 0.5
const HEIGHT_SCALE_MAX = 1.5

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

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

/** Minimum pair spacing that keeps the currently visible lid-clipped eyes from overlapping. */
export function anchoredPairSpacingMin(model: FaceModel): number {
  const current = Math.min(SPACING_MAX, Math.max(SPACING_MIN, anchoredPairSpacing(model)))
  const apply = (value: number) => setAnchoredPairSpacing(model, value)

  if (!visibleEyesOverlap(apply(SPACING_MIN))) return SPACING_MIN

  let safe = current
  if (visibleEyesOverlap(apply(safe))) {
    if (visibleEyesOverlap(apply(SPACING_MAX))) return current
    safe = SPACING_MAX
  }

  let unsafe = SPACING_MIN
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (unsafe + safe) / 2
    if (visibleEyesOverlap(apply(midpoint))) unsafe = midpoint
    else safe = midpoint
  }

  return safe
}

export function anchoredPairSpacingMax(model: FaceModel): number {
  const current = Math.max(SPACING_MIN, anchoredPairSpacing(model))
  return safeUpperBound(current, SPACING_MAX, (value) => setAnchoredPairSpacing(model, value))
}

export function setAnchoredPairSpacingSafely(model: FaceModel, spacing: number): FaceModel {
  const minimum = anchoredPairSpacingMin(model)
  const maximum = anchoredPairSpacingMax(model)
  if (minimum > maximum) return model
  return setAnchoredPairSpacing(model, Math.min(maximum, Math.max(minimum, spacing)))
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

function applySharedLidValue(model: FaceModel, key: LidKey, value: number): FaceModel {
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

function applySideLidValue(
  model: FaceModel,
  side: 'left' | 'right',
  key: LidKey,
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

function nearestFittableLidValue(
  current: number,
  requested: number,
  apply: (value: number) => FaceModel,
): number {
  const target = clamp01(requested)
  if (canFitEyesInCanvas(apply(target))) return target
  if (!canFitEyesInCanvas(apply(current))) return current

  let safe = current
  let unsafe = target
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (canFitEyesInCanvas(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

/**
 * Keep the current gaze value, but translate the eye pair by the smallest amount that
 * produces the same safe rendered position clampGaze would have chosen.
 */
export function translatePairToKeepCurrentGaze(model: FaceModel): FaceModel {
  const clamped = clampGaze(model)
  const deltaX = clamped.gaze.x - model.gaze.x
  const deltaY = clamped.gaze.y - model.gaze.y
  if (Math.abs(deltaX) < 1e-9 && Math.abs(deltaY) < 1e-9) return model

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: {
        ...model.leftEye.geometry,
        position: {
          x: model.leftEye.geometry.position.x + deltaX,
          y: model.leftEye.geometry.position.y + deltaY,
        },
      },
    },
    rightEye: {
      ...model.rightEye,
      geometry: {
        ...model.rightEye.geometry,
        position: {
          x: model.rightEye.geometry.position.x + deltaX,
          y: model.rightEye.geometry.position.y + deltaY,
        },
      },
    },
    gaze: model.gaze,
  }
}

export function setSharedLidSafely(model: FaceModel, key: LidKey, value: number): FaceModel {
  const current = model.expression[key]
  const safe = nearestFittableLidValue(current, value, (candidate) =>
    applySharedLidValue(model, key, candidate),
  )
  return translatePairToKeepCurrentGaze(applySharedLidValue(model, key, safe))
}

export function setSideLidSafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: LidKey,
  value: number,
): FaceModel {
  const expression = side === 'left' ? model.expression.leftEye : model.expression.rightEye
  const current = expression?.[key] ?? model.expression[key]
  const safe = nearestFittableLidValue(current, value, (candidate) =>
    applySideLidValue(model, side, key, candidate),
  )
  return translatePairToKeepCurrentGaze(applySideLidValue(model, side, key, safe))
}

export function isExpressionGeometryKey(key: keyof EyeExpression): key is ExpressionGeometryKey {
  return key === 'tilt' || key === 'heightScale'
}

export function isLidKey(key: keyof EyeExpression): key is LidKey {
  return key === 'upperLid' || key === 'lowerLid'
}
