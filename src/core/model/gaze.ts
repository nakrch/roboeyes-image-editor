import {
  resolveEyeExpression,
  resolveEyeLidAperture,
  resolveGazeReactiveHeightScale,
} from './expression'
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

type VisibleEyeRect = {
  center: { x: number; y: number }
  axisX: { x: number; y: number }
  axisY: { x: number; y: number }
  halfWidth: number
  halfHeight: number
  hasVisibleArea: boolean
}

const STROKE_HALF_WIDTH = 0.5
const OVERLAP_EPSILON = 1e-9

function visibleEyeRect(
  model: FaceModel,
  side: 'left' | 'right',
  geometry: EyeGeometry,
): VisibleEyeRect {
  const expression = resolveEyeExpression(model.expression, side)
  const aperture = resolveEyeLidAperture(model.expression, side)
  const effectiveHeightScale = resolveGazeReactiveHeightScale(
    model.expression,
    side,
    model.gaze.x,
    model.canvas.width,
  )
  const scaledHeight = Math.max(0, geometry.height * effectiveHeightScale)
  const upperLeftY = -scaledHeight / 2 + scaledHeight * aperture.upperLeft
  const upperRightY = -scaledHeight / 2 + scaledHeight * aperture.upperRight
  const lowerY = -scaledHeight / 2 + scaledHeight * aperture.lower
  const lowerMidY = -scaledHeight / 2 + scaledHeight * aperture.lowerMid
  const upperMidY = (upperLeftY + upperRightY) / 2
  const localTop = Math.min(upperLeftY, upperRightY, upperMidY)
  const localBottom = Math.max(lowerY, lowerMidY)
  const visibleHeight = Math.max(0, localBottom - localTop)
  const visibleCenterOffsetY = (localTop + localBottom) / 2
  const effectiveRotation = geometry.rotation + (side === 'left' ? -expression.tilt : expression.tilt)
  const radians = (effectiveRotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  const center = {
    x: geometry.position.x - visibleCenterOffsetY * sin,
    y: geometry.position.y + visibleCenterOffsetY * cos,
  }
  const hasVisibleArea = visibleHeight > 0 && scaledHeight > 0 && geometry.width > 0

  return {
    center,
    axisX: { x: cos, y: sin },
    axisY: { x: -sin, y: cos },
    halfWidth: hasVisibleArea ? Math.max(0, geometry.width) / 2 + STROKE_HALF_WIDTH : 0,
    halfHeight: hasVisibleArea ? visibleHeight / 2 + STROKE_HALF_WIDTH : 0,
    hasVisibleArea,
  }
}

function eyeBounds(
  model: FaceModel,
  side: 'left' | 'right',
  geometry: EyeGeometry,
): Bounds {
  const rect = visibleEyeRect(model, side, geometry)
  const halfExtentX = Math.abs(rect.axisX.x) * rect.halfWidth + Math.abs(rect.axisY.x) * rect.halfHeight
  const halfExtentY = Math.abs(rect.axisX.y) * rect.halfWidth + Math.abs(rect.axisY.y) * rect.halfHeight

  return {
    left: rect.center.x - halfExtentX,
    right: rect.center.x + halfExtentX,
    top: rect.center.y - halfExtentY,
    bottom: rect.center.y + halfExtentY,
  }
}

function projectionRadius(rect: VisibleEyeRect, axis: { x: number; y: number }): number {
  const dotX = Math.abs(axis.x * rect.axisX.x + axis.y * rect.axisX.y)
  const dotY = Math.abs(axis.x * rect.axisY.x + axis.y * rect.axisY.y)
  return rect.halfWidth * dotX + rect.halfHeight * dotY
}

/** Whether the two currently visible, lid-clipped eye rectangles overlap. */
export function visibleEyesOverlap(model: FaceModel): boolean {
  const left = visibleEyeRect(model, 'left', model.leftEye.geometry)
  const right = visibleEyeRect(model, 'right', model.rightEye.geometry)
  if (!left.hasVisibleArea || !right.hasVisibleArea) return false

  const centerDelta = {
    x: right.center.x - left.center.x,
    y: right.center.y - left.center.y,
  }
  const axes = [left.axisX, left.axisY, right.axisX, right.axisY]

  for (const axis of axes) {
    const centerDistance = Math.abs(centerDelta.x * axis.x + centerDelta.y * axis.y)
    const requiredDistance = projectionRadius(left, axis) + projectionRadius(right, axis)
    if (centerDistance >= requiredDistance - OVERLAP_EPSILON) return false
  }

  return true
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
