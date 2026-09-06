import { describe, expect, it } from 'vitest'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { isGazeCanvasSafe, visibleEyesOverlap } from '../../core/model'
import { setIndependentEyePositionSafely } from './eyePositionSafety'
import { resizeCanvasFromCenter } from './modelEditing'

const createModel = () => roboEyesToFaceModel(defaultRoboEyesPreset)

function expectSafe(model: ReturnType<typeof createModel>) {
  expect(isGazeCanvasSafe(model)).toBe(true)
  expect(visibleEyesOverlap(model)).toBe(false)
}

describe('independent eye position safety', () => {
  it('prevents the left eye from overlapping the right eye when moving right', () => {
    const model = createModel()
    const originalRight = model.rightEye.geometry.position

    const next = setIndependentEyePositionSafely(model, 'left', 'x', 640)

    expectSafe(next)
    expect(next.leftEye.geometry.position.x).toBeLessThan(next.rightEye.geometry.position.x)
    expect(next.rightEye.geometry.position).toEqual(originalRight)
  })

  it('prevents the right eye from overlapping the left eye when moving left', () => {
    const model = createModel()
    const originalLeft = model.leftEye.geometry.position

    const next = setIndependentEyePositionSafely(model, 'right', 'x', -320)

    expectSafe(next)
    expect(next.rightEye.geometry.position.x).toBeGreaterThan(next.leftEye.geometry.position.x)
    expect(next.leftEye.geometry.position).toEqual(originalLeft)
  })

  it('keeps the left eye inside the canvas at the left boundary', () => {
    const next = setIndependentEyePositionSafely(createModel(), 'left', 'x', -320)
    expectSafe(next)
    expect(next.leftEye.geometry.position.x).toBeGreaterThan(-320)
  })

  it('keeps the right eye inside the canvas at the right boundary', () => {
    const next = setIndependentEyePositionSafely(createModel(), 'right', 'x', 640)
    expectSafe(next)
    expect(next.rightEye.geometry.position.x).toBeLessThan(640)
  })

  it('keeps an independently moved eye inside the vertical canvas bounds', () => {
    const model = createModel()
    const above = setIndependentEyePositionSafely(model, 'left', 'y', -320)
    const below = setIndependentEyePositionSafely(model, 'right', 'y', 640)

    expectSafe(above)
    expectSafe(below)
  })

  it('allows a normal independent move that remains safe', () => {
    const model = createModel()
    const requested = model.leftEye.geometry.position.x - 4

    const next = setIndependentEyePositionSafely(model, 'left', 'x', requested)

    expect(next.leftEye.geometry.position.x).toBe(requested)
    expectSafe(next)
  })

  it('accounts for the current eye size when clamping position', () => {
    const model = createModel()
    model.leftEye.geometry.width = 56

    const next = setIndependentEyePositionSafely(model, 'left', 'x', -320)

    expectSafe(next)
    expect(next.leftEye.geometry.position.x).toBeGreaterThan(28)
  })

  it('keeps overlap and canvas constraints after increasing canvas width and height', () => {
    const resized = resizeCanvasFromCenter(createModel(), 320, 240)
    const leftAcrossPair = setIndependentEyePositionSafely(resized, 'left', 'x', 640)
    const rightOutsideBottom = setIndependentEyePositionSafely(resized, 'right', 'y', 640)

    expectSafe(leftAcrossPair)
    expectSafe(rightOutsideBottom)
    expect(leftAcrossPair.leftEye.geometry.position.x).toBeLessThan(leftAcrossPair.rightEye.geometry.position.x)
    expect(rightOutsideBottom.rightEye.geometry.position.y).toBeLessThan(240)
  })

  it('can recover horizontal position when a canvas resize leaves the current model outside', () => {
    const model = createModel()
    model.leftEye.geometry.position.x = 20
    expectSafe(model)

    const resized = resizeCanvasFromCenter(model, 100, 64)
    expect(isGazeCanvasSafe(resized)).toBe(false)

    const recovered = setIndependentEyePositionSafely(resized, 'left', 'x', 19)

    expectSafe(recovered)
    expect(recovered.leftEye.geometry.position.x).toBeCloseTo(19)
  })

  it('can recover vertical position when a canvas resize leaves the current model outside', () => {
    const model = createModel()
    model.leftEye.geometry.position.y = 19
    expectSafe(model)

    const resized = resizeCanvasFromCenter(model, 128, 50)
    expect(isGazeCanvasSafe(resized)).toBe(false)

    const recovered = setIndependentEyePositionSafely(resized, 'left', 'y', 19)

    expectSafe(recovered)
    expect(recovered.leftEye.geometry.position.y).toBeCloseTo(19)
  })
})
