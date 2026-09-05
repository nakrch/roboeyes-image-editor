import { describe, expect, it } from 'vitest'
import type { FaceModel } from './face'
import { clampGaze, gazeLimits, minimumCanvasSize } from './gaze'

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
