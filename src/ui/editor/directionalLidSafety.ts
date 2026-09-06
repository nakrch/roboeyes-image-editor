import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  resolveEyeExpression,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import { translatePairToKeepCurrentGaze } from './geometrySafety'

export type DirectionalLidKey = 'upperLidInner' | 'upperLidOuter' | 'lowerLidCurvature'

const REFINE_STEPS = 24
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function sharedCurrent(model: FaceModel, key: DirectionalLidKey): number {
  if (key === 'upperLidInner') return model.expression.upperLidInner ?? model.expression.upperLid
  if (key === 'upperLidOuter') return model.expression.upperLidOuter ?? model.expression.upperLid
  return model.expression.lowerLidCurvature ?? 0
}

function applyShared(model: FaceModel, key: DirectionalLidKey, value: number): FaceModel {
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
  key: DirectionalLidKey,
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

function normalizeCandidate(model: FaceModel): FaceModel {
  return translatePairToKeepCurrentGaze(model)
}

function isCandidateSafe(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

function nearestSafe(
  model: FaceModel,
  current: number,
  requested: number,
  apply: (value: number) => FaceModel,
): FaceModel {
  const target = clamp01(requested)
  const requestedModel = normalizeCandidate(apply(target))
  if (isCandidateSafe(requestedModel)) return requestedModel

  const currentModel = normalizeCandidate(apply(current))
  if (!isCandidateSafe(currentModel)) return model

  let safeValue = current
  let unsafeValue = target
  let safeModel = currentModel
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safeValue + unsafeValue) / 2
    const candidate = normalizeCandidate(apply(midpoint))
    if (isCandidateSafe(candidate)) {
      safeValue = midpoint
      safeModel = candidate
    } else {
      unsafeValue = midpoint
    }
  }
  return safeModel
}

export function setSharedDirectionalLidSafely(
  model: FaceModel,
  key: DirectionalLidKey,
  value: number,
): FaceModel {
  return nearestSafe(model, sharedCurrent(model, key), value, (candidate) =>
    applyShared(model, key, candidate),
  )
}

export function setIndependentDirectionalLidSafely(
  model: FaceModel,
  side: 'left' | 'right',
  key: DirectionalLidKey,
  value: number,
): FaceModel {
  const current = resolveEyeExpression(model.expression, side)[key]
  return nearestSafe(model, current, value, (candidate) => applySide(model, side, key, candidate))
}

export function isDirectionalLidKey(key: PropertyKey): key is DirectionalLidKey {
  return key === 'upperLidInner' || key === 'upperLidOuter' || key === 'lowerLidCurvature'
}
