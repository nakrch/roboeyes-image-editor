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

/**
 * Orthographic sphere-cap projection with the edge fixed: θ = strength · 0.45π,
 * f(ρ) = sin(θρ) / sin(θ) inside the inscribed ellipse (barrel: the center
 * magnifies by θ / sin θ, the rim compresses). Outside it (rectangle corners)
 * the slope θ·cot θ is faded by (1 − strength), so at full strength content
 * beyond the rim is pressed onto it and never leaves a circular display.
 */
export function lensRadialMap(rho: number, strength: number): number {
  const theta = strength * 0.45 * Math.PI
  if (theta === 0) return rho
  const sine = Math.sin(theta)
  return rho <= 1
    ? Math.sin(theta * rho) / sine
    : 1 + (1 - strength) * (theta * Math.cos(theta) / sine) * (rho - 1)
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
