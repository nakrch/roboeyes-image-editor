import type { Point } from './eye'
import type { CanvasModel } from './face'

export type LensFit = 'circle' | 'rect'
export type LensModel = { kind: 'sphere'; strength: number; fit: LensFit }

export function isLensModel(value: unknown): value is LensModel {
  if (value === null || typeof value !== 'object') return false
  const lens = value as Partial<LensModel>
  return lens.kind === 'sphere' && (lens.fit === 'circle' || lens.fit === 'rect') &&
    typeof lens.strength === 'number' && Number.isFinite(lens.strength) &&
    lens.strength >= 0 && lens.strength <= 1
}

export function resolveLensStrength(model: { lens?: LensModel }): number {
  return Math.min(1, Math.max(0, model.lens?.strength ?? 0))
}

/**
 * Orthographic sphere-cap projection with the edge fixed: θ = strength · 0.45π,
 * f(ρ) = sin(θρ) / sin(θ) within either fit's boundary. The circle fit uses
 * the inscribed display-mask circle and presses points outside it onto its rim.
 * The rect fit uses an eighth-power superellipse and leaves points outside
 * its boundary unchanged, preserving rectangular display corners.
 */
export function lensRadialMap(rho: number, strength: number, fit: LensFit): number {
  const theta = strength * 0.45 * Math.PI
  if (theta === 0) return rho
  if (rho > 1) return fit === 'circle' ? 1 : rho
  return Math.sin(theta * rho) / Math.sin(theta)
}

export function warpPointThroughLens(point: Point, canvas: CanvasModel, lens: LensModel): Point {
  if (lens.strength === 0 || canvas.width <= 0 || canvas.height <= 0) return point
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const rx = lens.fit === 'circle' ? Math.min(cx, cy) : cx
  const ry = lens.fit === 'circle' ? rx : cy
  const ux = (point.x - cx) / rx
  const uy = (point.y - cy) / ry
  const rho = lens.fit === 'circle'
    ? Math.hypot(ux, uy)
    : (Math.abs(ux) ** 8 + Math.abs(uy) ** 8) ** (1 / 8)
  if (rho === 0) return point
  const scale = lensRadialMap(rho, lens.strength, lens.fit) / rho
  return { x: cx + ux * scale * rx, y: cy + uy * scale * ry }
}
