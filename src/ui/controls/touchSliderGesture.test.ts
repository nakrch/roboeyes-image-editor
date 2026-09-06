import { describe, expect, it } from 'vitest'
import {
  classifyTouchSliderIntent,
  TOUCH_DRAG_THRESHOLD_PX,
  TOUCH_FINE_DRAG_SCALE,
  valueFromTouchSliderDrag,
} from './touchSliderGesture'

describe('touch slider gesture', () => {
  it('keeps a tap or tiny movement pending', () => {
    expect(classifyTouchSliderIntent(0, 0)).toBe('pending')
    expect(classifyTouchSliderIntent(TOUCH_DRAG_THRESHOLD_PX - 1, 1)).toBe('pending')
  })

  it('activates an intentional horizontal drag after the threshold', () => {
    expect(classifyTouchSliderIntent(TOUCH_DRAG_THRESHOLD_PX, 1)).toBe('horizontal')
    expect(classifyTouchSliderIntent(-12, 3)).toBe('horizontal')
  })

  it('treats a predominantly vertical gesture as scrolling intent', () => {
    expect(classifyTouchSliderIntent(2, TOUCH_DRAG_THRESHOLD_PX)).toBe('vertical')
    expect(classifyTouchSliderIntent(6, 20)).toBe('vertical')
  })

  it('changes values relatively to horizontal drag distance', () => {
    expect(valueFromTouchSliderDrag(50, 20, 100, 0, 100)).toBe(70)
    expect(valueFromTouchSliderDrag(50, -20, 100, 0, 100)).toBe(30)
  })

  it('applies fine drag sensitivity for touch adjustment', () => {
    const expectedDelta = 20 * TOUCH_FINE_DRAG_SCALE
    expect(valueFromTouchSliderDrag(50, 20, 100, 0, 100, TOUCH_FINE_DRAG_SCALE)).toBe(50 + expectedDelta)
    expect(valueFromTouchSliderDrag(50, -20, 100, 0, 100, TOUCH_FINE_DRAG_SCALE)).toBe(50 - expectedDelta)
  })

  it('clamps fine drag values to the slider range', () => {
    expect(valueFromTouchSliderDrag(90, 100, 100, 0, 100, TOUCH_FINE_DRAG_SCALE)).toBe(100)
    expect(valueFromTouchSliderDrag(10, -100, 100, 0, 100, TOUCH_FINE_DRAG_SCALE)).toBe(0)
  })

  it('keeps full-sensitivity relative drag clamping unchanged', () => {
    expect(valueFromTouchSliderDrag(90, 50, 100, 0, 100)).toBe(100)
    expect(valueFromTouchSliderDrag(10, -50, 100, 0, 100)).toBe(0)
  })

  it('keeps the starting value for an invalid track width', () => {
    expect(valueFromTouchSliderDrag(42, 20, 0, 0, 100, TOUCH_FINE_DRAG_SCALE)).toBe(42)
  })
})
