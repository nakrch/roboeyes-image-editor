import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { canFitEyesInCanvas } from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import {
  pairRotation,
  pairRotationLimits,
  rotatePair,
  rotatePairSafely,
} from './modelEditing'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

const centerDistance = (model: ReturnType<typeof createModel>) => {
  const left = model.leftEye.geometry.position
  const right = model.rightEye.geometry.position
  return Math.hypot(right.x - left.x, right.y - left.y)
}

describe('linked rotation canvas constraints', () => {
  it('limits the default 128x64 face before the rotated pair can no longer fit', () => {
    const model = createModel()
    const limits = pairRotationLimits(model)

    expect(limits.min).toBeGreaterThan(-45)
    expect(limits.max).toBeLessThan(45)
    expect(limits.min).toBeLessThan(0)
    expect(limits.max).toBeGreaterThan(0)
    expect(canFitEyesInCanvas(rotatePair(model, limits.max))).toBe(true)
    expect(canFitEyesInCanvas(rotatePair(model, limits.min))).toBe(true)
  })

  it('clamps typed large positive and negative values to safe visible angles', () => {
    const model = createModel()
    const limits = pairRotationLimits(model)
    const distance = centerDistance(model)
    const positive = rotatePairSafely(model, 45)
    const negative = rotatePairSafely(model, -45)

    expect(pairRotation(positive)).toBeCloseTo(limits.max, 4)
    expect(pairRotation(negative)).toBeCloseTo(limits.min, 4)
    expect(canFitEyesInCanvas(positive)).toBe(true)
    expect(canFitEyesInCanvas(negative)).toBe(true)
    expect(centerDistance(positive)).toBeCloseTo(distance)
    expect(centerDistance(negative)).toBeCloseTo(distance)
  })
})
