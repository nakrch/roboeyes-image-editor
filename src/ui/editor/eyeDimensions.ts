import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import {
  updateEyeGeometry,
  type EyeSide,
} from './modelEditing'
import {
  anchoredPairSpacing,
  setAnchoredPairSpacing,
} from './geometrySafety'

export type EyeDimensionKey = 'width' | 'height'
export type EyeDimensionLimits = { width: number; height: number }
export type EyeDimensionRange = { min: number; max: number }
export type EyeDimensionRanges = { width: EyeDimensionRange; height: EyeDimensionRange }

const EYE_DIMENSION_MIN = 1
const EYE_DIMENSION_MAX = 160
const DIMENSION_REFINE_STEPS = 18
const DIMENSION_SCAN_STEPS = 320

function applyLinkedDimension(
  model: FaceModel,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  if (key === 'width') {
    const spacing = anchoredPairSpacing(model)
    const resized = {
      ...model,
      leftEye: {
        ...model.leftEye,
        geometry: { ...model.leftEye.geometry, width: value },
      },
      rightEye: {
        ...model.rightEye,
        geometry: { ...model.rightEye.geometry, width: value },
      },
    }

    return setAnchoredPairSpacing(resized, spacing)
  }

  return {
    ...model,
    leftEye: {
      ...model.leftEye,
      geometry: { ...model.leftEye.geometry, height: value },
    },
    rightEye: {
      ...model.rightEye,
      geometry: { ...model.rightEye.geometry, height: value },
    },
  }
}

function applyIndependentDimension(
  model: FaceModel,
  side: EyeSide,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  return updateEyeGeometry(model, side, (geometry) => ({ ...geometry, [key]: value }))
}

function isDimensionCandidateSafe(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

function refineDimensionBoundary(
  safeValue: number,
  unsafeValue: number,
  apply: (value: number) => FaceModel,
): number {
  let safe = safeValue
  let unsafe = unsafeValue
  for (let index = 0; index < DIMENSION_REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (isDimensionCandidateSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

function scanDimensionBoundary(
  anchor: number,
  endpoint: number,
  apply: (value: number) => FaceModel,
): number {
  if (anchor === endpoint) return anchor
  let previous = anchor

  for (let index = 1; index <= DIMENSION_SCAN_STEPS; index += 1) {
    const candidate = anchor + (endpoint - anchor) * (index / DIMENSION_SCAN_STEPS)
    if (!isDimensionCandidateSafe(apply(candidate))) {
      return refineDimensionBoundary(previous, candidate, apply)
    }
    previous = candidate
  }

  return endpoint
}

function findDimensionAnchor(
  currentValue: number,
  apply: (value: number) => FaceModel,
): number | undefined {
  const current = Math.min(EYE_DIMENSION_MAX, Math.max(EYE_DIMENSION_MIN, currentValue))
  if (isDimensionCandidateSafe(apply(current))) return current

  let best: number | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index <= DIMENSION_SCAN_STEPS; index += 1) {
    const candidate = EYE_DIMENSION_MIN +
      (EYE_DIMENSION_MAX - EYE_DIMENSION_MIN) * (index / DIMENSION_SCAN_STEPS)
    if (!isDimensionCandidateSafe(apply(candidate))) continue
    const distance = Math.abs(candidate - current)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

function safeDimensionRange(
  currentValue: number,
  apply: (value: number) => FaceModel,
): EyeDimensionRange {
  const anchor = findDimensionAnchor(currentValue, apply)
  if (anchor === undefined) {
    const current = Math.min(EYE_DIMENSION_MAX, Math.max(EYE_DIMENSION_MIN, currentValue))
    return { min: current, max: current }
  }

  return {
    min: scanDimensionBoundary(anchor, EYE_DIMENSION_MIN, apply),
    max: scanDimensionBoundary(anchor, EYE_DIMENSION_MAX, apply),
  }
}

export function linkedEyeDimensionRanges(model: FaceModel): EyeDimensionRanges {
  const currentWidth = (model.leftEye.geometry.width + model.rightEye.geometry.width) / 2
  const currentHeight = (model.leftEye.geometry.height + model.rightEye.geometry.height) / 2

  return {
    width: safeDimensionRange(currentWidth, (value) =>
      applyLinkedDimension(model, 'width', value),
    ),
    height: safeDimensionRange(currentHeight, (value) =>
      applyLinkedDimension(model, 'height', value),
    ),
  }
}

export function independentEyeDimensionRanges(
  model: FaceModel,
  side: EyeSide,
): EyeDimensionRanges {
  const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry

  return {
    width: safeDimensionRange(geometry.width, (value) =>
      applyIndependentDimension(model, side, 'width', value),
    ),
    height: safeDimensionRange(geometry.height, (value) =>
      applyIndependentDimension(model, side, 'height', value),
    ),
  }
}

export function linkedEyeDimensionLimits(model: FaceModel): EyeDimensionLimits {
  const ranges = linkedEyeDimensionRanges(model)
  return { width: ranges.width.max, height: ranges.height.max }
}

export function independentEyeDimensionLimits(
  model: FaceModel,
  side: EyeSide,
): EyeDimensionLimits {
  const ranges = independentEyeDimensionRanges(model, side)
  return { width: ranges.width.max, height: ranges.height.max }
}

export function setLinkedEyeDimensionSafely(
  model: FaceModel,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  const range = linkedEyeDimensionRanges(model)[key]
  const safeValue = Math.min(range.max, Math.max(range.min, value))
  const next = applyLinkedDimension(model, key, safeValue)
  return isDimensionCandidateSafe(next) ? next : model
}

export function setIndependentEyeDimensionSafely(
  model: FaceModel,
  side: EyeSide,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  const range = independentEyeDimensionRanges(model, side)[key]
  const safeValue = Math.min(range.max, Math.max(range.min, value))
  const next = applyIndependentDimension(model, side, key, safeValue)
  return isDimensionCandidateSafe(next) ? next : model
}
