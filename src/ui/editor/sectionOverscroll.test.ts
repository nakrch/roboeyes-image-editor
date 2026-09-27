import { describe, expect, it } from 'vitest'
import { WHEEL_LINE_PX } from '../controls/wheelSliderStep'
import {
  SECTION_OVERSCROLL_IDLE_MS,
  SECTION_OVERSCROLL_THRESHOLD_PX,
  SectionOverscrollTracker,
  type SectionOverscrollInput,
} from './sectionOverscroll'

const input = (deltaY: number, timeStamp: number, overrides: Partial<SectionOverscrollInput> = {}): SectionOverscrollInput => ({
  deltaX: 0, deltaY, deltaMode: 0, atTop: true, atBottom: true, pageHeightPx: 600, timeStamp, ...overrides,
})
const idle = { direction: null, progress: 0, switchTo: null }

describe('SectionOverscrollTracker', () => {
  it('switches down only at the threshold and locks out continued momentum until the idle gap', () => {
    const tracker = new SectionOverscrollTracker()
    const threshold = SECTION_OVERSCROLL_THRESHOLD_PX
    expect(tracker.wheel(input(100, 0))).toEqual({ direction: 'next', progress: 100 / threshold, switchTo: null })
    expect(tracker.wheel(input(threshold - 101, 10))).toEqual({ direction: 'next', progress: (threshold - 1) / threshold, switchTo: null })
    expect(tracker.wheel(input(1, 20))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    expect(tracker.wheel(input(threshold, 30))).toEqual(idle)
    expect(tracker.wheel(input(threshold, 30 + SECTION_OVERSCROLL_IDLE_MS))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
  })

  it('normalizes line and page deltas to pixel distance', () => {
    const lines = new SectionOverscrollTracker()
    expect(lines.wheel(input(3, 0, { deltaMode: 1 })).progress).toBeCloseTo(3 * WHEEL_LINE_PX / SECTION_OVERSCROLL_THRESHOLD_PX)
    expect(lines.wheel(input(6, 10, { deltaMode: 1 }))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    const pages = new SectionOverscrollTracker()
    expect(pages.wheel(input(-0.5, 0, { deltaMode: 2 }))).toEqual({ direction: 'previous', progress: 1, switchTo: 'previous' })
  })

  it('requires the corresponding edge and locks after normal scrolling until a new stream', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 300 })
    expect(tracker.wheel(input(100, 0, { atBottom: false }))).toEqual(idle)
    expect(tracker.wheel(input(300, 10))).toEqual(idle)
    expect(tracker.wheel(input(-300, 20))).toEqual(idle)
    expect(tracker.wheel(input(-300, 20 + SECTION_OVERSCROLL_IDLE_MS, { atTop: true }))).toEqual({ direction: 'previous', progress: 1, switchTo: 'previous' })
    expect(new SectionOverscrollTracker().wheel(input(-100, 0, { atTop: false }))).toEqual(idle)
  })

  it('discards prior distance on reversal or an idle gap', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 300 })
    tracker.wheel(input(200, 0))
    expect(tracker.wheel(input(-100, 10))).toEqual({ direction: 'previous', progress: 1 / 3, switchTo: null })
    expect(tracker.wheel(input(-100, 10 + SECTION_OVERSCROLL_IDLE_MS))).toEqual({ direction: 'previous', progress: 1 / 3, switchTo: null })
  })

  it('ignores horizontal-dominant and zero-vertical events while retaining stream timing', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 300 })
    tracker.wheel(input(100, 0))
    expect(tracker.wheel(input(100, 300, { deltaX: 101 }))).toEqual(idle)
    expect(tracker.wheel(input(0, 400))).toEqual(idle)
    expect(tracker.wheel(input(100, 410))).toEqual({ direction: 'next', progress: 2 / 3, switchTo: null })
    expect(tracker.wheel(input(100, 420))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    expect(tracker.wheel(input(0, 420 + SECTION_OVERSCROLL_IDLE_MS))).toEqual(idle)
    expect(tracker.wheel(input(100, 430 + SECTION_OVERSCROLL_IDLE_MS))).toEqual({ direction: 'next', progress: 1 / 3, switchTo: null })
  })

  it('reset clears partial distance and the post-switch lock', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 300 })
    tracker.wheel(input(200, 0))
    tracker.reset()
    expect(tracker.wheel(input(100, 10))).toEqual({ direction: 'next', progress: 1 / 3, switchTo: null })
    tracker.wheel(input(200, 20))
    tracker.reset()
    expect(tracker.wheel(input(-100, 30))).toEqual({ direction: 'previous', progress: 1 / 3, switchTo: null })
  })
})
