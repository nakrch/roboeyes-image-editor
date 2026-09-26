import type { Point } from './eye'
import type { CanvasModel } from './face'

export type LensModel = { kind: 'sphere'; strength: number }

export function isLensModel(value: unknown): value is LensModel {
  if (value === null || typeof value !== 'object') return false
  const lens = value as Partial<LensModel>
  return lens.kind === 'sphere' && typeof lens.strength === 'number' &&
    Number.isFinite(lens.strength) && lens.strength >= 0 && lens.strength <= 1
}

export function resolveLensStrength(model: { lens?: LensModel }): number {
  return Math.min(1, Math.max(0, model.lens?.strength ?? 0))
}

export function lensRadialMap(rho: number, strength: number): number {
  const k = 0.9 * strength
  return rho <= 1 ? rho + k * (rho ** 3 - rho ** 4) : 1 + (1 - k) * (rho - 1)
}

export function warpPointThroughLens(point: Point, canvas: CanvasModel, strength: number): Point {
  if (strength === 0 || canvas.width <= 0 || canvas.height <= 0) return point
  const rx = canvas.width / 2
  const ry = canvas.height / 2
  const ux = (point.x - rx) / rx
  const uy = (point.y - ry) / ry
  const rho = Math.hypot(ux, uy)
  if (rho === 0) return point
  const scale = lensRadialMap(rho, strength) / rho
  return { x: rx + ux * scale * rx, y: ry + uy * scale * ry }
}
