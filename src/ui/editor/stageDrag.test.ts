import { describe, expect, it } from 'vitest'
import { minimalPreset } from '../../core/presets'
import { rigidEyePositionRange } from './eyePositionSafety'
import { pairCenterX, pairCenterY } from './modelEditing'
import { enableSingleEyeLayout } from './singleEyeLayout'
import { applyStageDrag, pointerToCanvas } from './stageDrag'

const fixture = () => structuredClone(minimalPreset.model)

describe('stage eye dragging', () => {
  it('translates a linked pair rigidly regardless of grabbed eye', () => {
    const model = fixture()
    const moved = applyStageDrag(model, 'right', true, { dx: 9, dy: 4 })
    expect(pairCenterX(moved)).toBeCloseTo(pairCenterX(model) + 9)
    expect(pairCenterY(moved)).toBeCloseTo(pairCenterY(model) + 4)
    expect(moved.rightEye.geometry.position.x - moved.leftEye.geometry.position.x).toBe(44)
    expect(moved.rightEye.geometry.position.y - moved.leftEye.geometry.position.y).toBe(0)
    expect(model.leftEye.geometry.position.x).toBe(42)
  })

  it('moves only the grabbed eye independently', () => {
    const model = fixture()
    const moved = applyStageDrag(model, 'left', false, { dx: -8, dy: 5 })
    expect(moved.leftEye.geometry.position).toEqual({ x: 34, y: 37 })
    expect(moved.rightEye).toEqual(model.rightEye)
  })

  it('moves the single visible eye while retaining the hidden eye offset', () => {
    const model = enableSingleEyeLayout(fixture())
    const moved = applyStageDrag(model, 'left', false, { dx: 8, dy: -5 })
    expect(moved.leftEye.geometry.position.x).toBe(model.leftEye.geometry.position.x + 8)
    expect(moved.leftEye.geometry.position.y).toBe(model.leftEye.geometry.position.y - 5)
    expect(moved.rightEye.geometry.position.x - moved.leftEye.geometry.position.x).toBe(model.rightEye.geometry.position.x - model.leftEye.geometry.position.x)
  })

  it('clamps linked and single-eye drags at the same slider limits', () => {
    const model = fixture()
    const xRange = rigidEyePositionRange(model, 'x', pairCenterX(model))
    const yRange = rigidEyePositionRange(model, 'y', pairCenterY(model))
    const linked = applyStageDrag(model, 'left', true, { dx: 10000, dy: -10000 })
    expect(pairCenterX(linked)).toBeCloseTo(xRange.max)
    expect(pairCenterY(linked)).toBeCloseTo(yRange.min)
    const single = enableSingleEyeLayout(fixture())
    const position = single.leftEye.geometry.position
    const singleRange = rigidEyePositionRange(single, 'x', position.x)
    expect(applyStageDrag(single, 'left', true, { dx: -10000, dy: 0 }).leftEye.geometry.position.x).toBeCloseTo(singleRange.min)
  })

  it('stops an independent eye at its canvas boundary', () => {
    const model = fixture()
    const range = rigidEyePositionRange({ ...model, eyeVisibility: { left: true, right: false } }, 'x', model.leftEye.geometry.position.x)
    const moved = applyStageDrag(model, 'left', false, { dx: -10000, dy: 0 })
    expect(moved.leftEye.geometry.position.x).toBeGreaterThanOrEqual(range.min - 1e-8)
    expect(moved.rightEye.geometry.position).toEqual(model.rightEye.geometry.position)
  })

  it('converts client coordinates using fractional rendered frame dimensions', () => {
    expect(pointerToCanvas(151.5, 82.25, { left: 23.5, top: 18.25, width: 192, height: 96 }, { width: 128, height: 64 })).toEqual({ x: 85.33333333333333, y: 42.666666666666664 })
  })
})
