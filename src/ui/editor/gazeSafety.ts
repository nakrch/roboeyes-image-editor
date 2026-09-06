import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  type FaceModel,
} from '../../core/model'

const SCAN_STEPS = 320
const REFINE_STEPS = 24

type GazeAxis = 'x' | 'y'

function applyGaze(model: FaceModel, axis: GazeAxis, value: number): FaceModel {
  return {
    ...model,
    gaze: {
      ...model.gaze,
      [axis]: value,
    },
  }
}

function isCandidateSafe(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model)
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

/**
 * Move one gaze axis toward the requested value, stopping at the first unsafe
 * geometry boundary. This is intentionally evaluated along the path because
 * gaze-reactive expression geometry can change as horizontal gaze changes.
 */
export function setGazeSafely(
  model: FaceModel,
  axis: GazeAxis,
  requested: number,
): FaceModel {
  const current = model.gaze[axis]
  if (requested === current) return model
  const apply = (value: number) => applyGaze(model, axis, value)

  if (!isCandidateSafe(model)) return model
  if (isCandidateSafe(apply(requested))) return apply(requested)

  let previous = current
  for (let index = 1; index <= SCAN_STEPS; index += 1) {
    const candidate = current + (requested - current) * (index / SCAN_STEPS)
    if (!isCandidateSafe(apply(candidate))) {
      return apply(refineBoundary(previous, candidate, apply))
    }
    previous = candidate
  }

  return apply(previous)
}
