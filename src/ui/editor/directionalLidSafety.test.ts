import { describe, expect, it } from 'vitest'
import { isGazeCanvasSafe, resolveEyeExpression, visibleEyesOverlap } from '../../core/model'
import { minimalPreset } from '../../core/presets'
import {
  setIndependentDirectionalLidSafely,
  setSharedDirectionalLidSafely,
} from './directionalLidSafety'

describe('directional lid safety', () => {
  it('applies linked directional lids and clears per-eye overrides', () => {
    const model = structuredClone(minimalPreset.model)
    model.expression.leftEye = { upperLidInner: 0.9 }
    model.expression.rightEye = { upperLidOuter: 0.8 }

    const next = setSharedDirectionalLidSafely(model, 'upperLidInner', 0.45)

    expect(next.expression.upperLidInner).toBeCloseTo(0.45)
    expect(next.expression.leftEye).toBeUndefined()
    expect(next.expression.rightEye).toBeUndefined()
    expect(isGazeCanvasSafe(next)).toBe(true)
    expect(visibleEyesOverlap(next)).toBe(false)
  })

  it('keeps independent directional edits isolated to one eye', () => {
    const model = structuredClone(minimalPreset.model)
    const next = setIndependentDirectionalLidSafely(model, 'left', 'upperLidOuter', 0.65)

    expect(resolveEyeExpression(next.expression, 'left').upperLidOuter).toBeCloseTo(0.65)
    expect(resolveEyeExpression(next.expression, 'right').upperLidOuter).toBe(0)
    expect(isGazeCanvasSafe(next)).toBe(true)
    expect(visibleEyesOverlap(next)).toBe(false)
  })

  it('supports a curved lower cut without violating current canvas safety', () => {
    const model = structuredClone(minimalPreset.model)
    const next = setSharedDirectionalLidSafely(model, 'lowerLidCurvature', 1)

    expect(next.expression.lowerLidCurvature).toBe(1)
    expect(isGazeCanvasSafe(next)).toBe(true)
    expect(visibleEyesOverlap(next)).toBe(false)
  })
})
