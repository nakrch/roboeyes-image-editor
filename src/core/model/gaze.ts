import { resolveEyeExpression } from './expression'
import type { EyeGeometry } from './eye'
import type { FaceModel } from './face'

export type NumericRange = {
  min: number
  max: number
}

export type GazeLimits = {
  x: NumericRange
  y: NumericRange
}

export type CanvasMinimumSize = {
  width: number
  height: number
}

type Bounds = {
  left: number
  right: number
  top: number
  bottom: number
}

const STROKE_HALF_WIDTH = 0.5
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function eyeBounds(
  model: FaceModel,
  side: 'left' | 'right',
  geometry: EyeGeometry,
): Bounds {
  const expression = resolveEyeExpression(model.expression, side)
  const scaledHeight = Math.max(0, geometry.height * expression.heightScale)
  const upper = clamp01(expression.upperLid)
  const lower = clamp01(expression.lowerLid)
  const visibleHeight = Math.max(0, scaledHeight * (1 - upper - lower))
  const visibleCenterOffsetY = scaledHeight * (upper - lower) / 2
  const effectiveRotation = geometry.rotation + (side === 'left' ? -expression.tilt : expression.tilt)
  const radians = (effectiveRotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const absCos = Math.abs(cos)
  const absSin = Math.abs(sin)

  // The renderer clips each eye to the lid-defined visible aperture before rotation.
  // Rotate that aperture's shifted center around the eye pivot so constraints follow
  // the portion that is actually visible instead of the hidden full-eye rectangle.
  const centerX = geometry.position.x - visibleCenterOffsetY * sin
  const centerY = geometry.position.y + visibleCenterOffsetY * cos

  // Preserve the existing 1px-stroke safety margin for any non-empty aperture.
  // A fully closed eye renders no visible area, so collapse it to its aperture center.
  const hasVisibleArea = visibleHeight > 0
  const halfWidth = hasVisibleArea
    ? Math.max(0, geometry.width) / 2 + STROKE_HALF_WIDTH
    : 0
  const halfHeight = hasVisibleArea ? visibleHeight / 2 + STROKE_HALF_WIDTH : 0
  const halfExtentX = absCos * halfWidth + absSin * halfHeight
  const halfExtentY = absSin * halfWidth + absCos * halfHeight

  return {
    left: centerX - halfExtentX,
    right: centerX + halfExtentX,
    top: centerY - halfExtentY,
    bottom: centerY + halfExtentY,
  }
}

function rawSafeRange(bounds: Bounds[], size: number, start: 'left' | 'top', end: 'right' | 'bottom'): NumericRange {
  return {
    min: Math.max(...bounds.map((bound) => -bound[start])),
    max: Math.min(...bounds.map((bound) => size - bound[end])),
  }
}

function safeRange(bounds: Bounds[], size: number, start: 'left' | 'top', end: 'right' | 'bottom'): NumericRange {
  const range = rawSafeRange(bounds, size, start, end)
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) {
    return { min: 0, max: 0 }
  }
  return range
}

function modelBounds(model: FaceModel): Bounds[] {
  return [
    eyeBounds(model, 'left', model.leftEye.geometry),
    eyeBounds(model, 'right', model.rightEye.geometry),
  ]
}

export function canFitEyesInCanvas(model: FaceModel): boolean {
  const bounds = modelBounds(model)
  const x = rawSafeRange(bounds, Math.max(0, model.canvas.width), 'left', 'right')
  const y = rawSafeRange(bounds, Math.max(0, model.canvas.height), 'top', 'bottom')

  return Number.isFinite(x.min) && Number.isFinite(x.max) && x.min <= x.max &&
    Number.isFinite(y.min) && Number.isFinite(y.max) && y.min <= y.max
}

export function minimumCanvasSize(model: FaceModel): CanvasMinimumSize {
  const bounds = modelBounds(model).map((bound) => ({
    left: bound.left + model.gaze.x,
    right: bound.right + model.gaze.x,
    top: bound.top + model.gaze.y,
    bottom: bound.bottom + model.gaze.y,
  }))
  const centerX = model.canvas.width / 2
  const centerY = model.canvas.height / 2
  const left = Math.min(...bounds.map((bound) => bound.left))
  const right = Math.max(...bounds.map((bound) => bound.right))
  const top = Math.min(...bounds.map((bound) => bound.top))
  const bottom = Math.max(...bounds.map((bound) => bound.bottom))

  return {
    width: 2 * Math.max(centerX - left, right - centerX),
    height: 2 * Math.max(centerY - top, bottom - centerY),
  }
}

export function gazeLimits(model: FaceModel): GazeLimits {
  const bounds = modelBounds(model)
  return {
    x: safeRange(bounds, Math.max(0, model.canvas.width), 'left', 'right'),
    y: safeRange(bounds, Math.max(0, model.canvas.height), 'top', 'bottom'),
  }
}

/** Whether the model's current gaze keeps both rendered eyes fully inside the canvas. */
export function isGazeCanvasSafe(model: FaceModel): boolean {
  const limits = gazeLimits(model)
  return model.gaze.x >= limits.x.min && model.gaze.x <= limits.x.max &&
    model.gaze.y >= limits.y.min && model.gaze.y <= limits.y.max
}

function clamp(value: number, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}

export function clampGaze(model: FaceModel): FaceModel {
  const limits = gazeLimits(model)
  const x = clamp(model.gaze.x, limits.x)
  const y = clamp(model.gaze.y, limits.y)
  if (x === model.gaze.x && y === model.gaze.y) return model
  return { ...model, gaze: { x, y } }
}
