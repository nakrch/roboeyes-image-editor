import { describe, expect, it } from 'vitest'
import { areEyeLidAperturesValid, resolveEyeLidAperture } from '../../core/model'
import { minimalPreset } from '../../core/presets'
import {
  setIndependentComposedLidSafely,
  setIndependentDirectionalLidSafely,
  setSharedComposedLidSafely,
  setSharedDirectionalLidSafely,
} from './directionalLidSafety'

describe('composed lid safety', () => {
  it('keeps shared upper lid effective after inner and outer offsets are edited', () => {
    let model = structuredClone(minimalPreset.model)
    model = setSharedDirectionalLidSafely(model, 'upperLidInner', 0.3)
    model = setSharedDirectionalLidSafely(model, 'upperLidOuter', 0.1)
    model = setSharedComposedLidSafely(model, 'upperLid', 0.2)

    const left = resolveEyeLidAperture(model.expression, 'left')
    expect(left.upperLeft).toBeCloseTo(0.3)
    expect(left.upperRight).toBeCloseTo(0.5)
    expect(areEyeLidAperturesValid(model.expression)).toBe(true)
  })

  it('clamps lower lid before it can cross a large outer upper mask', () => {
    let model = structuredClone(minimalPreset.model)
    model = setSharedDirectionalLidSafely(model, 'upperLidOuter', 0.9)
    model = setSharedComposedLidSafely(model, 'lowerLid', 0.5)

    expect(model.expression.lowerLid).toBeLessThanOrEqual(0.1000001)
    expect(areEyeLidAperturesValid(model.expression)).toBe(true)
  })

  it('clamps directional offset against an existing lower lid', () => {
    let model = structuredClone(minimalPreset.model)
    model = setSharedComposedLidSafely(model, 'upperLid', 0.2)
    model = setSharedComposedLidSafely(model, 'lowerLid', 0.3)
    model = setSharedDirectionalLidSafely(model, 'upperLidOuter', 0.9)

    expect(model.expression.upperLidOuter).toBeLessThanOrEqual(0.5000001)
    expect(areEyeLidAperturesValid(model.expression)).toBe(true)
  })

  it('keeps independent lid edits isolated and valid', () => {
    let model = structuredClone(minimalPreset.model)
    model = setIndependentDirectionalLidSafely(model, 'left', 'upperLidInner', 0.4)
    model = setIndependentComposedLidSafely(model, 'left', 'upperLid', 0.25)

    const left = resolveEyeLidAperture(model.expression, 'left')
    const right = resolveEyeLidAperture(model.expression, 'right')
    expect(left.upperRight).toBeCloseTo(0.65)
    expect(right.upperLeft).toBe(0)
    expect(right.upperRight).toBe(0)
    expect(areEyeLidAperturesValid(model.expression)).toBe(true)
  })
})
