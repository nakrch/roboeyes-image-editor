import { describe, expect, it } from 'vitest'
import { isLensModel, lensRadialMap, resolveLensStrength, warpPointThroughLens } from './lens'

describe('sphere lens geometry', () => {
  const canvas = { width: 320, height: 240 }

  it('requires a valid fit, strength and lens kind', () => {
    expect(isLensModel({ kind: 'sphere', strength: 0.5, fit: 'rect' })).toBe(true)
    expect(isLensModel({ kind: 'sphere', strength: 0.5, fit: 'circle' })).toBe(true)
    expect(isLensModel({ kind: 'sphere', strength: 0.5 })).toBe(false)
    expect(isLensModel({ kind: 'sphere', strength: 0.5, fit: 'ellipse' })).toBe(false)
    expect(isLensModel({ kind: 'sphere', strength: 2, fit: 'rect' })).toBe(false)
    expect(isLensModel({ kind: 'x', strength: 0.5, fit: 'rect' })).toBe(false)
    expect(isLensModel({ kind: 'sphere', strength: Number.NaN, fit: 'rect' })).toBe(false)
    expect(resolveLensStrength({})).toBe(0)
    expect(resolveLensStrength({ lens: { kind: 'sphere', strength: 2, fit: 'rect' } })).toBe(1)
  })

  it('keeps the rim fixed and maps outside according to fit', () => {
    for (const fit of ['circle', 'rect'] as const) {
      expect(lensRadialMap(0, 1, fit)).toBe(0)
      expect(lensRadialMap(1, 1, fit)).toBe(1)
      for (const strength of [0.25, 0.5, 1]) {
        let previous = -1
        for (let i = 0; i <= 100; i += 1) {
          const rho = i / 100
          const mapped = lensRadialMap(rho, strength, fit)
          expect(mapped).toBeGreaterThan(previous)
          expect(mapped).toBeGreaterThanOrEqual(rho)
          previous = mapped
        }
        expect(lensRadialMap(1.5, strength, fit)).toBe(fit === 'circle' ? 1 : 1.5)
      }
    }
  })

  it('keeps every sampled point within the circular mask at partial and full strength', () => {
    for (const strength of [0.25, 1]) {
      for (let x = 0; x <= canvas.width; x += 8) {
        for (let y = 0; y <= canvas.height; y += 8) {
          const point = warpPointThroughLens({ x, y }, canvas, { kind: 'sphere', strength, fit: 'circle' })
          expect(Math.hypot(point.x - 160, point.y - 120)).toBeLessThanOrEqual(120 + 1e-9)
        }
      }
    }
  })

  it('preserves rectangular corners and maps the sampled grid injectively within the canvas', () => {
    const lens = { kind: 'sphere', strength: 1, fit: 'rect' } as const
    const outputs = new Set<string>()
    for (let x = 0; x <= canvas.width; x += 8) {
      for (let y = 0; y <= canvas.height; y += 8) {
        const point = warpPointThroughLens({ x, y }, canvas, lens)
        expect(point.x).toBeGreaterThanOrEqual(-1e-9)
        expect(point.x).toBeLessThanOrEqual(canvas.width + 1e-9)
        expect(point.y).toBeGreaterThanOrEqual(-1e-9)
        expect(point.y).toBeLessThanOrEqual(canvas.height + 1e-9)
        const key = `${point.x.toFixed(9)},${point.y.toFixed(9)}`
        expect(outputs.has(key)).toBe(false)
        outputs.add(key)
      }
    }
    for (const x of [0, canvas.width]) {
      for (const y of [0, canvas.height]) {
        const point = warpPointThroughLens({ x, y }, canvas, lens)
        expect(point.x).toBeCloseTo(x, 10)
        expect(point.y).toBeCloseTo(y, 10)
      }
    }
  })

  it('has decreasing tangential scale inside either fit', () => {
    for (const fit of ['circle', 'rect'] as const) {
      let previousScale = Infinity
      for (let i = 1; i <= 100; i += 1) {
        const rho = i / 100
        const scale = lensRadialMap(rho, 1, fit) / rho
        expect(scale).toBeLessThan(previousScale)
        previousScale = scale
      }
    }
  })

  it('is the identity at strength zero for both fits', () => {
    for (const fit of ['circle', 'rect'] as const) {
      for (const point of [{ x: 0, y: 0 }, { x: 123, y: 217 }, { x: 320, y: 240 }]) {
        expect(lensRadialMap(1.5, 0, fit)).toBe(1.5)
        expect(warpPointThroughLens(point, canvas, { kind: 'sphere', strength: 0, fit })).toBe(point)
      }
      const point = { x: 10, y: 10 }
      expect(warpPointThroughLens(point, { width: 0, height: 64 }, { kind: 'sphere', strength: 1, fit })).toBe(point)
    }
  })
})
