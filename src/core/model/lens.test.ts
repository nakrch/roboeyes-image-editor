import { describe, expect, it } from 'vitest'
import { isLensModel, lensRadialMap, resolveLensStrength, warpPointThroughLens } from './lens'

describe('sphere lens geometry', () => {
  it('validates strength and lens kind', () => {
    expect(isLensModel({ kind: 'sphere', strength: 0.5 })).toBe(true)
    expect(isLensModel({ kind: 'sphere', strength: 2 })).toBe(false)
    expect(isLensModel({ kind: 'x', strength: 0.5 })).toBe(false)
    expect(isLensModel({ kind: 'sphere', strength: Number.NaN })).toBe(false)
    expect(resolveLensStrength({})).toBe(0)
    expect(resolveLensStrength({ lens: { kind: 'sphere', strength: 2 } })).toBe(1)
  })

  it('fixes the center and rim, increases strictly inside the rim and never expands outside it', () => {
    expect(lensRadialMap(0, 1)).toBe(0)
    expect(lensRadialMap(1, 1)).toBe(1)
    for (const strength of [0.25, 0.5, 1]) {
      let previous = -1
      for (let i = 0; i <= 200; i += 1) {
        const rho = i / 100
        const mapped = lensRadialMap(rho, strength)
        if (rho <= 1) expect(mapped).toBeGreaterThan(previous)
        else expect(mapped).toBeGreaterThanOrEqual(previous)
        expect(mapped >= rho).toBe(rho <= 1)
        expect(lensRadialMap(rho, 0)).toBeCloseTo(rho, 12)
        previous = mapped
      }
    }
  })

  it('presses content beyond the rim onto it at full strength, so eyes stay inside a circular display', () => {
    const canvas = { width: 240, height: 240 }
    for (let x = 0; x <= canvas.width; x += 8) {
      for (let y = 0; y <= canvas.height; y += 8) {
        const point = warpPointThroughLens({ x, y }, canvas, 1)
        expect(Math.hypot(point.x - 120, point.y - 120)).toBeLessThanOrEqual(120 + 1e-9)
      }
    }
  })

  it('is barrel-shaped so straight eye edges bulge outward instead of denting toward the center', () => {
    let previousScale = Infinity
    for (let i = 1; i <= 100; i += 1) {
      const rho = i / 100
      const tangentialScale = lensRadialMap(rho, 1) / rho
      expect(tangentialScale).toBeLessThan(previousScale)
      previousScale = tangentialScale
    }
  })

  it('keeps all sampled canvas points, including corners, within the rectangle', () => {
    const canvas = { width: 128, height: 64 }
    for (let x = 0; x <= canvas.width; x += 4) {
      for (let y = 0; y <= canvas.height; y += 4) {
        const point = warpPointThroughLens({ x, y }, canvas, 1)
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(canvas.width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(canvas.height)
      }
    }
    expect(warpPointThroughLens({ x: 10, y: 10 }, { width: 0, height: 64 }, 1)).toEqual({ x: 10, y: 10 })
  })
})
