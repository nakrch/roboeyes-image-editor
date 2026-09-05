import { describe, expect, it } from 'vitest'
import { canFitEyesInCanvas } from '../../core/model'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { pairSpacing } from './modelEditing'
import {
  independentEyeDimensionLimits,
  linkedEyeDimensionLimits,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from './eyeDimensions'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

describe('eye dimension constraints', () => {
  it('limits linked width to a canvas-safe maximum', () => {
    const model = createModel()
    const limits = linkedEyeDimensionLimits(model)
    const next = setLinkedEyeDimensionSafely(model, 'width', 160)

    expect(limits.width).toBeLessThan(160)
    expect(next.leftEye.geometry.width).toBeCloseTo(limits.width)
    expect(next.rightEye.geometry.width).toBeCloseTo(limits.width)
    expect(pairSpacing(next)).toBeCloseTo(pairSpacing(model))
    expect(canFitEyesInCanvas(next)).toBe(true)
  })

  it('limits linked height to a canvas-safe maximum', () => {
    const model = createModel()
    const limits = linkedEyeDimensionLimits(model)
    const next = setLinkedEyeDimensionSafely(model, 'height', 160)

    expect(limits.height).toBeLessThan(160)
    expect(next.leftEye.geometry.height).toBeCloseTo(limits.height)
    expect(next.rightEye.geometry.height).toBeCloseTo(limits.height)
    expect(canFitEyesInCanvas(next)).toBe(true)
  })

  it('limits only the edited eye in independent mode', () => {
    const model = createModel()
    const originalRight = model.rightEye.geometry.width
    const limits = independentEyeDimensionLimits(model, 'left')
    const next = setIndependentEyeDimensionSafely(model, 'left', 'width', 160)

    expect(limits.width).toBeLessThan(160)
    expect(next.leftEye.geometry.width).toBeCloseTo(limits.width)
    expect(next.rightEye.geometry.width).toBe(originalRight)
    expect(canFitEyesInCanvas(next)).toBe(true)
  })
})
