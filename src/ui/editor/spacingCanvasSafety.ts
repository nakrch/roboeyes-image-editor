import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMin,
  setAnchoredPairSpacing,
} from './geometrySafety'

const SPACING_MAX = 160
const REFINE_STEPS = 20

function isSpacingCandidateSafe(model: FaceModel): boolean {
  // `gazeLimits()` intentionally collapses an impossible axis to {0, 0}; therefore
  // isGazeCanvasSafe() alone is not sufficient when current gaze is zero. Require
  // actual geometric fit as well.
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
}

/** Maximum spacing reachable from the current safe pair without overflowing the canvas. */
export function canvasSafeAnchoredPairSpacingMax(model: FaceModel): number {
  const current = Math.max(0, anchoredPairSpacing(model))
  const apply = (value: number) => setAnchoredPairSpacing(model, value)

  if (!isSpacingCandidateSafe(apply(current))) return current
  if (isSpacingCandidateSafe(apply(SPACING_MAX))) return SPACING_MAX

  let safe = current
  let unsafe = SPACING_MAX
  for (let index = 0; index < REFINE_STEPS; index += 1) {
    const midpoint = (safe + unsafe) / 2
    if (isSpacingCandidateSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

/** Clamp spacing to the visible non-overlap minimum and the current rotated canvas-fit maximum. */
export function setCanvasSafeAnchoredPairSpacing(model: FaceModel, spacing: number): FaceModel {
  const minimum = anchoredPairSpacingMin(model)
  const maximum = canvasSafeAnchoredPairSpacingMax(model)
  if (minimum > maximum) return model

  const requested = Math.min(maximum, Math.max(minimum, spacing))
  const next = setAnchoredPairSpacing(model, requested)
  return isSpacingCandidateSafe(next) ? next : model
}
