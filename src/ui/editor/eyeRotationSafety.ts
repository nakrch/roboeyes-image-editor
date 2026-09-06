import {
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  visibleEyesOverlap,
  type FaceModel,
} from '../../core/model'
import { updateEyeGeometry, type EyeSide } from './modelEditing'

export type EyeRotationRange = { min: number; max: number }

const ROTATION_MIN = -45
const ROTATION_MAX = 45
const SCAN_STEPS = 360
const REFINE_STEPS = 24

function applyRotation(model: FaceModel, side: EyeSide, value: number): FaceModel {
  return updateEyeGeometry(model, side, (geometry) => ({ ...geometry, rotation: value }))
}

function isRotationCandidateSafe(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model) && !visibleEyesOverlap(model)
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
    if (isRotationCandidateSafe(apply(midpoint))) safe = midpoint
    else unsafe = midpoint
  }
  return safe
}

function scanBoundary(
  anchor: number,
  endpoint: number,
  apply: (value: number) => FaceModel,
): number {
  if (anchor === endpoint) return anchor
  let previous = anchor

  for (let index = 1; index <= SCAN_STEPS; index += 1) {
    const candidate = anchor + (endpoint - anchor) * (index / SCAN_STEPS)
    if (!isRotationCandidateSafe(apply(candidate))) {
      return refineBoundary(previous, candidate, apply)
    }
    previous = candidate
  }

  return endpoint
}

function findAnchor(
  current: number,
  apply: (value: number) => FaceModel,
): number | undefined {
  const clamped = Math.min(ROTATION_MAX, Math.max(ROTATION_MIN, current))
  if (isRotationCandidateSafe(apply(clamped))) return clamped

  let best: number | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index <= SCAN_STEPS; index += 1) {
    const candidate = ROTATION_MIN + (ROTATION_MAX - ROTATION_MIN) * (index / SCAN_STEPS)
    if (!isRotationCandidateSafe(apply(candidate))) continue
    const distance = Math.abs(candidate - clamped)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function independentEyeRotationRange(model: FaceModel, side: EyeSide): EyeRotationRange {
  const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry
  const apply = (value: number) => applyRotation(model, side, value)
  const anchor = findAnchor(geometry.rotation, apply)
  if (anchor === undefined) return { min: geometry.rotation, max: geometry.rotation }

  return {
    min: scanBoundary(anchor, ROTATION_MIN, apply),
    max: scanBoundary(anchor, ROTATION_MAX, apply),
  }
}

export function setIndependentEyeRotationSafely(
  model: FaceModel,
  side: EyeSide,
  value: number,
): FaceModel {
  const range = independentEyeRotationRange(model, side)
  const safe = Math.min(range.max, Math.max(range.min, value))
  const next = applyRotation(model, side, safe)
  return isRotationCandidateSafe(next) ? next : model
}
