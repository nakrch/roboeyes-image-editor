import { canFitEyesInCanvas, type FaceModel } from '../../core/model'
import {
  pairSpacing,
  setHorizontalLayout,
  updateEyeGeometry,
  type EyeSide,
} from './modelEditing'

export type EyeDimensionKey = 'width' | 'height'
export type EyeDimensionLimits = { width: number; height: number }

const EYE_DIMENSION_MIN = 1
const EYE_DIMENSION_MAX = 160
const DIMENSION_REFINE_STEPS = 18

function applyLinkedDimension(
  model: FaceModel,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  if (key === 'width') {
    return setHorizontalLayout(model, value, value, pairSpacing(model))
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

function safeDimensionMax(
  model: FaceModel,
  currentValue: number,
  apply: (value: number) => FaceModel,
): number {
  if (canFitEyesInCanvas(apply(EYE_DIMENSION_MAX))) return EYE_DIMENSION_MAX

  if (!canFitEyesInCanvas(apply(EYE_DIMENSION_MIN))) {
    return Math.min(EYE_DIMENSION_MAX, Math.max(EYE_DIMENSION_MIN, currentValue))
  }

  let safe = EYE_DIMENSION_MIN
  let unsafe = EYE_DIMENSION_MAX

  for (let index = 0; index < DIMENSION_REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (canFitEyesInCanvas(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }

  return safe
}

/** Canvas-safe maximum dimensions when both eyes are edited together. */
export function linkedEyeDimensionLimits(model: FaceModel): EyeDimensionLimits {
  const currentWidth = (model.leftEye.geometry.width + model.rightEye.geometry.width) / 2
  const currentHeight = (model.leftEye.geometry.height + model.rightEye.geometry.height) / 2

  return {
    width: safeDimensionMax(model, currentWidth, (value) =>
      applyLinkedDimension(model, 'width', value),
    ),
    height: safeDimensionMax(model, currentHeight, (value) =>
      applyLinkedDimension(model, 'height', value),
    ),
  }
}

/** Canvas-safe maximum dimensions for one independently edited eye. */
export function independentEyeDimensionLimits(
  model: FaceModel,
  side: EyeSide,
): EyeDimensionLimits {
  const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry

  return {
    width: safeDimensionMax(model, geometry.width, (value) =>
      applyIndependentDimension(model, side, 'width', value),
    ),
    height: safeDimensionMax(model, geometry.height, (value) =>
      applyIndependentDimension(model, side, 'height', value),
    ),
  }
}

export function setLinkedEyeDimensionSafely(
  model: FaceModel,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  const limits = linkedEyeDimensionLimits(model)
  const safeValue = Math.min(limits[key], Math.max(EYE_DIMENSION_MIN, value))
  return applyLinkedDimension(model, key, safeValue)
}

export function setIndependentEyeDimensionSafely(
  model: FaceModel,
  side: EyeSide,
  key: EyeDimensionKey,
  value: number,
): FaceModel {
  const limits = independentEyeDimensionLimits(model, side)
  const safeValue = Math.min(limits[key], Math.max(EYE_DIMENSION_MIN, value))
  return applyIndependentDimension(model, side, key, safeValue)
}
