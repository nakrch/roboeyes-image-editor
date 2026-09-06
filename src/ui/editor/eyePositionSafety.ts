import { isGazeCanvasSafe, visibleEyesOverlap, type FaceModel } from '../../core/model'
import { updateEyeGeometry, type EyeSide } from './modelEditing'

export type EyePositionAxis = 'x' | 'y'

const PATH_SCAN_STEPS = 128
const BOUNDARY_REFINE_STEPS = 40

function positionValue(model: FaceModel, side: EyeSide, axis: EyePositionAxis): number {
  const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry
  return geometry.position[axis]
}

function withEyePosition(
  model: FaceModel,
  side: EyeSide,
  axis: EyePositionAxis,
  value: number,
): FaceModel {
  return updateEyeGeometry(model, side, (geometry) => ({
    ...geometry,
    position: { ...geometry.position, [axis]: value },
  }))
}

function isIndependentPositionSafe(model: FaceModel): boolean {
  return isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/**
 * Move one eye along a single axis without allowing it to leave the canvas or pass
 * through the other visible eye. If the requested value is unsafe, the move stops
 * at the first safe boundary encountered from the eye's current position.
 */
export function setIndependentEyePositionSafely(
  model: FaceModel,
  side: EyeSide,
  axis: EyePositionAxis,
  requestedValue: number,
): FaceModel {
  const startValue = positionValue(model, side, axis)
  if (requestedValue === startValue) return model

  // Independent editing is expected to start from a valid state. If an older preset
  // or imported model is already invalid, avoid making the geometry less predictable.
  if (!isIndependentPositionSafe(model)) return model

  let lastSafeT = 0

  // Scan the complete path rather than checking only the destination. This prevents
  // an eye from "teleporting" through the other eye to another safe position.
  for (let step = 1; step <= PATH_SCAN_STEPS; step += 1) {
    const t = step / PATH_SCAN_STEPS
    const candidate = withEyePosition(
      model,
      side,
      axis,
      interpolate(startValue, requestedValue, t),
    )

    if (isIndependentPositionSafe(candidate)) {
      lastSafeT = t
      continue
    }

    let safeT = lastSafeT
    let unsafeT = t
    for (let refine = 0; refine < BOUNDARY_REFINE_STEPS; refine += 1) {
      const midpointT = (safeT + unsafeT) / 2
      const midpoint = withEyePosition(
        model,
        side,
        axis,
        interpolate(startValue, requestedValue, midpointT),
      )

      if (isIndependentPositionSafe(midpoint)) safeT = midpointT
      else unsafeT = midpointT
    }

    return withEyePosition(
      model,
      side,
      axis,
      interpolate(startValue, requestedValue, safeT),
    )
  }

  return withEyePosition(model, side, axis, requestedValue)
}
