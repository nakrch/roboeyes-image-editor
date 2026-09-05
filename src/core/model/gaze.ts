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

function eyeBounds(
  model: FaceModel,
  side: 'left' | 'right',
  geometry: EyeGeometry,
): Bounds {
  const expression = resolveEyeExpression(model.expression, side)
  const scaledHeight = Math.max(0, geometry.height * expression.heightScale)
  const effectiveRotation = geometry.rotation + (side === 'left' ? -expression.tilt : expression.tilt)
  const radians = (effectiveRotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))

  const halfWidth = Math.max(0, geometry.width) / 2 + STROKE_HALF_WIDTH
  const halfHeight = scaledHeight / 2 + STROKE_HALF_WIDTH
  const halfExtentX = cos * halfWidth + sin * halfHeight
  const halfExtentY = sin * halfWidth + cos * halfHeight

  return {
    left: geometry.position.x - halfExtentX,
    right: geometry.position.x + halfExtentX,
    top: geometry.position.y - halfExtentY,
    bottom: geometry.position.y + halfExtentY,
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
