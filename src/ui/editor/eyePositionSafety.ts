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

function refineSafeBoundary(
  model: FaceModel,
  side: EyeSide,
  axis: EyePositionAxis,
  startValue: number,
  requestedValue: number,
  safeT: number,
  unsafeT: number,
): number {
  let safe = safeT
  let unsafe = unsafeT

  for (let refine = 0; refine < BOUNDARY_REFINE_STEPS; refine += 1) {
    const midpointT = (safe + unsafe) / 2
    const midpoint = withEyePosition(
      model,
      side,
      axis,
      interpolate(startValue, requestedValue, midpointT),
    )

    if (isIndependentPositionSafe(midpoint)) safe = midpointT
    else unsafe = midpointT
  }

  return safe
}

/**
 * Move one eye along a single axis without allowing it to leave the canvas or pass
 * through the other visible eye. If the requested value is unsafe, the move stops
 * at the first safe boundary encountered from the eye's current position.
 *
 * Canvas/resolution edits can temporarily leave an older or imported model outside
 * the normal independent-position invariant. In that case a position edit is also
 * allowed to recover into a safe state instead of becoming permanently locked.
 */
export function setIndependentEyePositionSafely(
  model: FaceModel,
  side: EyeSide,
  axis: EyePositionAxis,
  requestedValue: number,
): FaceModel {
  const startValue = positionValue(model, side, axis)
  if (requestedValue === startValue) return model

  const requested = withEyePosition(model, side, axis, requestedValue)
  const startIsSafe = isIndependentPositionSafe(model)

  // When a canvas/resolution edit has left the current model invalid, allow the
  // position control to repair it. A directly safe destination is always accepted.
  if (!startIsSafe && isIndependentPositionSafe(requested)) return requested

  let lastSafeT: number | null = startIsSafe ? 0 : null

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
      // For an invalid starting state, the first safe sample marks recovery. From
      // there onward normal boundary clamping applies.
      lastSafeT = t
      continue
    }

    if (lastSafeT === null) continue

    const safeT = refineSafeBoundary(
      model,
      side,
      axis,
      startValue,
      requestedValue,
      lastSafeT,
      t,
    )

    return withEyePosition(
      model,
      side,
      axis,
      interpolate(startValue, requestedValue, safeT),
    )
  }

  if (lastSafeT !== null) {
    return withEyePosition(
      model,
      side,
      axis,
      interpolate(startValue, requestedValue, lastSafeT),
    )
  }

  // No safe point was found along this edit. Keep the current geometry unchanged.
  return model
}
