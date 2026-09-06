import { describe, expect, it } from 'vitest'
import type { FaceModel } from './face'
import { clampGaze, gazeLimits, isGazeCanvasSafe, minimumCanvasSize, visibleEyesOverlap } from './gaze'

function model(overrides: Partial<FaceModel> = {}): FaceModel {
  const base: FaceModel = {
    canvas: { width: 128, height: 64 },
    leftEye: {
      geometry: {
        position: { x: 42, y: 32 },
        width: 28,
        height: 18,
        cornerRadius: 8,
        rotation: 0,
      },
    },
    rightEye: {
      geometry: {
        position: { x: 86, y: 32 },
        width: 28,
        height: 18,
        cornerRadius: 8,
        rotation: 0,
      },
    },
    gaze: { x: 0, y: 0 },
    expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
    colors: { eye: '#fff', stroke: '#fff', background: '#000' },
  }

  return { ...base, ...overrides }
}

describe('gaze constraints', () => {
  it('derives safe limits for unrotated eyes', () => {
    const limits = gazeLimits(model())
    expect(limits.x.min).toBeCloseTo(-27.5)
    expect(limits.x.max).toBeCloseTo(27.5)
    expect(limits.y.min).toBeCloseTo(-22.5)
    expect(limits.y.max).toBeCloseTo(22.5)
  })

  it('reduces the safe range for rotated eyes', () => {
    const base = model()
    const rotated = model({
      leftEye: { geometry: { ...base.leftEye.geometry, rotation: 45 } },
      rightEye: { geometry: { ...base.rightEye.geometry, rotation: 45 } },
    })

    expect(gazeLimits(rotated).y.max).toBeLessThan(gazeLimits(base).y.max)
    expect(gazeLimits(rotated).x.max).toBeLessThan(gazeLimits(base).x.max)
  })

  it('accounts for expression height scaling', () => {
    const base = model()
    const surprised = model({ expression: { ...base.expression, heightScale: 1.5 } })

    expect(gazeLimits(surprised).y.max).toBeLessThan(gazeLimits(base).y.max)
  })

  it('excludes the region hidden by the upper lid from vertical constraints', () => {
    const base = model()
    const upperClosed = model({ expression: { ...base.expression, upperLid: 0.5 } })
    const normal = gazeLimits(base)
    const closed = gazeLimits(upperClosed)

    expect(closed.y.min).toBeLessThan(normal.y.min)
    expect(closed.y.min).toBeCloseTo(-31.5)
    expect(closed.y.max).toBeCloseTo(normal.y.max)
  })

  it('excludes the region hidden by the lower lid from vertical constraints', () => {
    const base = model()
    const lowerClosed = model({ expression: { ...base.expression, lowerLid: 0.5 } })
    const normal = gazeLimits(base)
    const closed = gazeLimits(lowerClosed)

    expect(closed.y.min).toBeCloseTo(normal.y.min)
    expect(closed.y.max).toBeGreaterThan(normal.y.max)
    expect(closed.y.max).toBeCloseTo(31.5)
  })

  it('uses the shifted visible aperture center when a lidded eye is rotated', () => {
    const base = model()
    const rotated = model({
      leftEye: { geometry: { ...base.leftEye.geometry, rotation: 45 } },
      rightEye: { geometry: { ...base.rightEye.geometry, rotation: 45 } },
    })
    const upperClosed = model({
      leftEye: { geometry: { ...base.leftEye.geometry, rotation: 45 } },
      rightEye: { geometry: { ...base.rightEye.geometry, rotation: 45 } },
      expression: { ...base.expression, upperLid: 0.5 },
    })

    const full = gazeLimits(rotated)
    const visible = gazeLimits(upperClosed)
    expect(visible.x.min).toBeLessThan(full.x.min)
    expect(visible.y.min).toBeLessThan(full.y.min)
  })

  it('keeps fully closed eyes numerically stable with minimal constraints', () => {
    const base = model()
    const closed = model({ expression: { ...base.expression, upperLid: 1, lowerLid: 0 } })
    const limits = gazeLimits(closed)

    expect(Number.isFinite(limits.x.min)).toBe(true)
    expect(Number.isFinite(limits.x.max)).toBe(true)
    expect(Number.isFinite(limits.y.min)).toBe(true)
    expect(Number.isFinite(limits.y.max)).toBe(true)
    expect(limits.x.max - limits.x.min).toBeGreaterThan(
      gazeLimits(base).x.max - gazeLimits(base).x.min,
    )
  })

  it('detects overlap between visible eye rectangles', () => {
    const base = model()
    const overlapping = model({
      leftEye: { geometry: { ...base.leftEye.geometry, position: { x: 55, y: 32 }, rotation: 20 } },
      rightEye: { geometry: { ...base.rightEye.geometry, position: { x: 73, y: 32 }, rotation: -20 } },
    })

    expect(visibleEyesOverlap(overlapping)).toBe(true)
    expect(visibleEyesOverlap(base)).toBe(false)
  })

  it('ignores fully lid-hidden eyes when checking overlap', () => {
    const base = model()
    const coincident = model({
      leftEye: { geometry: { ...base.leftEye.geometry, position: { x: 64, y: 32 } } },
      rightEye: { geometry: { ...base.rightEye.geometry, position: { x: 64, y: 32 } } },
      expression: { ...base.expression, upperLid: 1 },
    })

    expect(visibleEyesOverlap(coincident)).toBe(false)
  })

  it('collapses an impossible axis to neutral gaze', () => {
    const base = model()
    const impossible = model({
      leftEye: { geometry: { ...base.leftEye.geometry, width: 160 } },
      rightEye: { geometry: { ...base.rightEye.geometry, width: 160 } },
      gaze: { x: 30, y: 0 },
    })

    expect(gazeLimits(impossible).x).toEqual({ min: 0, max: 0 })
    expect(clampGaze(impossible).gaze.x).toBe(0)
  })

  it('does not treat the neutral fallback as canvas-safe when the eyes cannot fit', () => {
    const base = model()
    const impossible = model({
      leftEye: { geometry: { ...base.leftEye.geometry, width: 160 } },
      rightEye: { geometry: { ...base.rightEye.geometry, width: 160 } },
      gaze: { x: 0, y: 0 },
    })

    expect(gazeLimits(impossible).x).toEqual({ min: 0, max: 0 })
    expect(isGazeCanvasSafe(impossible)).toBe(false)
  })

  it('clamps existing gaze to the current safe range', () => {
    const current = model({ gaze: { x: 64, y: -64 } })
    const clamped = clampGaze(current)
    const limits = gazeLimits(current)

    expect(clamped.gaze.x).toBeCloseTo(limits.x.max)
    expect(clamped.gaze.y).toBeCloseTo(limits.y.min)
  })

  it('derives the minimum center-preserving canvas size for the current face', () => {
    expect(minimumCanvasSize(model())).toEqual({ width: 73, height: 19 })
  })

  it('reduces minimum canvas height when lids hide vertical eye regions', () => {
    const base = model()
    const lidded = model({ expression: { ...base.expression, upperLid: 0.25, lowerLid: 0.25 } })

    expect(minimumCanvasSize(lidded).height).toBeLessThan(minimumCanvasSize(base).height)
  })

  it('includes gaze and rotation when deriving minimum canvas size', () => {
    const base = model()
    const changed = model({
      leftEye: { geometry: { ...base.leftEye.geometry, rotation: 45 } },
      rightEye: { geometry: { ...base.rightEye.geometry, rotation: 45 } },
      gaze: { x: 10, y: -5 },
    })
    const minimum = minimumCanvasSize(changed)

    expect(minimum.width).toBeGreaterThan(minimumCanvasSize(base).width)
    expect(minimum.height).toBeGreaterThan(minimumCanvasSize(base).height)
  })
})
