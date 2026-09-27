import { describe, expect, it } from 'vitest'
import {
  consumeWheelSteps,
  WHEEL_LINE_PX,
  WHEEL_NOTCH_PX,
  wheelIncreasePixels,
  wheelStepSize,
} from './wheelSliderStep'

describe('wheelStepSize', () => {
  it('uses an explicit numeric step and multiplies it for coarse input', () => {
    expect(wheelStepSize(0, 80, 1)).toBe(1)
    expect(wheelStepSize(0, 1, 0.05)).toBe(0.05)
    expect(wheelStepSize(0, 80, 1, true)).toBe(10)
  })

  it('picks a round 1-2-5 step near 1/100 of the range for step="any", bounded to [0.01, 1]', () => {
    expect(wheelStepSize(0, 1, 'any')).toBe(0.01)
    expect(wheelStepSize(0, 3, 'any')).toBe(0.05)
    expect(wheelStepSize(-6, 6, 'any')).toBe(0.2)
    expect(wheelStepSize(-45, 45, 'any')).toBe(1)
    expect(wheelStepSize(4, 240, 'any')).toBe(1)
    expect(wheelStepSize(0.2, 0.25, 'any')).toBe(0.01)
    expect(wheelStepSize(0, 1, 'any', true)).toBeCloseTo(0.1)
  })
})

describe('wheelIncreasePixels', () => {
  it('maps wheel up and right to increases', () => {
    expect(wheelIncreasePixels(0, -100, 0)).toBe(100)
    expect(wheelIncreasePixels(0, 100, 0)).toBe(-100)
    expect(wheelIncreasePixels(100, 0, 0)).toBe(100)
  })

  it('normalizes line and page delta modes to pixels', () => {
    expect(wheelIncreasePixels(0, -3, 1)).toBeCloseTo(3 * WHEEL_LINE_PX)
    expect(wheelIncreasePixels(0, 1, 2)).toBe(-WHEEL_NOTCH_PX)
  })
})

describe('consumeWheelSteps', () => {
  it('turns one notch into one step', () => {
    expect(consumeWheelSteps(0, WHEEL_NOTCH_PX)).toEqual({ steps: 1, remainder: 0 })
    expect(consumeWheelSteps(0, -2 * WHEEL_NOTCH_PX)).toEqual({ steps: -2, remainder: 0 })
  })

  it('treats scaled notch-sized events as one step each', () => {
    expect(consumeWheelSteps(0, 80)).toEqual({ steps: 1, remainder: 0 })
    expect(consumeWheelSteps(0, -50)).toEqual({ steps: -1, remainder: 0 })
    expect(consumeWheelSteps(25, 80)).toEqual({ steps: 1, remainder: 0 })
  })

  it('accumulates small trackpad deltas until a full notch', () => {
    let accumulated = 0
    const steps: number[] = []
    for (let index = 0; index < 5; index += 1) {
      const result = consumeWheelSteps(accumulated, 30)
      accumulated = result.remainder
      steps.push(result.steps)
    }
    expect(steps).toEqual([0, 0, 0, 1, 0])
    expect(accumulated).toBeCloseTo(50)
  })

  it('drops the opposite remainder when the direction reverses', () => {
    expect(consumeWheelSteps(90, -WHEEL_NOTCH_PX)).toEqual({ steps: -1, remainder: 0 })
  })
})
