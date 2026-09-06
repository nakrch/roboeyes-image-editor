import {
  isGazeCanvasSafe,
  resolveEyeExpression,
  visibleEyesOverlap,
  type EyeExpression,
  type FaceModel,
} from '../../core/model'

export type GazeReactiveKey = 'gazeHeightExpansion' | 'gazeHeightThreshold'

const SCAN_STEPS = 160

function domain(key: GazeReactiveKey): { min: number; max: number } {
  return key === 'gazeHeightExpansion'
    ? { min: 0, max: 1 }
    : { min: 0, max: 1 }
}

function isCandidateSafe(model: FaceModel): boolean {
  return isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

function applyShared(
  model: FaceModel,
  key: GazeReactiveKey,
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

function applySide(
  model: FaceModel,
  side: 'left' | 'right',
  key: GazeReactiveKey,
  value: number,
): FaceModel {
  const property = side === 'left' ? 'leftEye' : 'rightEye'
  return {
    ...model,
    expression: {
      ...model.expression,
      [property]: {
        ...model.expression[property],
        [key]: value,
      },
    },
  }
}

function currentSharedValue(model: FaceModel, key: GazeReactiveKey): number {
  return key === 'gazeHeightExpansion'
    ? model.expression.gazeHeightExpansion ?? 0
    : model.expression.gazeHeightThreshold ?? 0.15
}

function currentSideValue(
  model: FaceModel,
  side: 'left' | 'right',
  key: GazeReactiveKey,
): number {
  const resolved = resolveEyeExpression(model.expression, side)
  return resolved[key]
}

function nearestSafeAlongPath(
  current: number,
  requested: number,
  apply: (value: number) => FaceModel,
  range: { min: number; max: number },
): number {
  const target = Math.min(range.max, Math.max(range.min, requested))
  if (isCandidateSafe(apply(target))) return target
  if (!isCandidateSafe(apply(current))) return current

  let safe = current
  for (let index = 1; index <= SCAN_STEPS; index += 1) {
    const candidate = current + (target - current) * (index / SCAN_STEPS)
    if (!isCandidateSafe(apply(candidate))) return safe
    safe = candidate
  }
  return safe
}

export function setSharedGazeReactiveSafely(
  model: FaceModel,
  key: GazeReactiveKey,
  value: number,
): FaceModel {
  const current = currentSharedValue(model, key)
  const safe = nearestSafeAlongPath(current, value, (candidate) => applyShared(model, key, candidate), domain(key))
  return applyShared(model, key, safe)
}

export function setIndependentGazeReactiveSafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: GazeReactiveKey,
  value: number,
): FaceModel {
  const current = currentSideValue(model, side, key)
  const safe = nearestSafeAlongPath(current, value, (candidate) => applySide(model, side, key, candidate), domain(key))
  return applySide(model, side, key, safe)
}

export function isGazeReactiveKey(key: keyof EyeExpression): key is GazeReactiveKey {
  return key === 'gazeHeightExpansion' || key === 'gazeHeightThreshold'
}
