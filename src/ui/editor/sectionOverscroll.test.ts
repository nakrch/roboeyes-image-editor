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
  it('switches at the threshold, then locks fine (trackpad) deltas until the idle gap', () => {
    const tracker = new SectionOverscrollTracker()
    const threshold = SECTION_OVERSCROLL_THRESHOLD_PX
    expect(tracker.wheel(input(100, 0))).toEqual({ direction: 'next', progress: 100 / threshold, switchTo: null })
    expect(tracker.wheel(input(threshold - 101, 10))).toEqual({ direction: 'next', progress: (threshold - 1) / threshold, switchTo: null })
    expect(tracker.wheel(input(1, 20))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    // Momentum after the switch: fine deltas in the same stream never accumulate.
    for (let t = 30; t < 30 + 100 * 10; t += 10) expect(tracker.wheel(input(30, t))).toEqual(idle)
    expect(tracker.wheel(input(30, 1030 + SECTION_OVERSCROLL_IDLE_MS))).toEqual({ direction: 'next', progress: 30 / threshold, switchTo: null })
  })

  it('keeps a continuous notch-wheel spin flowing: content scroll, then a fixed detent at each edge', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 240 })
    let t = 0
    const notch = (overrides: Partial<SectionOverscrollInput> = {}) => tracker.wheel(input(80, (t += 50), overrides))
    expect(notch({ atBottom: false })).toEqual(idle)
    expect(notch()).toEqual({ direction: 'next', progress: 1 / 3, switchTo: null })
    expect(notch()).toEqual({ direction: 'next', progress: 2 / 3, switchTo: null })
    expect(notch()).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    // The new section scrolls normally, then its own edge needs the full detent again.
    expect(notch({ atBottom: false })).toEqual(idle)
    expect(notch()).toEqual({ direction: 'next', progress: 1 / 3, switchTo: null })
    expect(notch()).toEqual({ direction: 'next', progress: 2 / 3, switchTo: null })
    expect(notch()).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    // Scrolling content mid-detent restarts it.
    notch()
    expect(notch({ atBottom: false })).toEqual(idle)
    expect(notch()).toEqual({ direction: 'next', progress: 1 / 3, switchTo: null })
  })

  it('normalizes line and page deltas to pixel distance', () => {
    const lines = new SectionOverscrollTracker()
    expect(lines.wheel(input(3, 0, { deltaMode: 1 })).progress).toBeCloseTo(3 * WHEEL_LINE_PX / SECTION_OVERSCROLL_THRESHOLD_PX)
    expect(lines.wheel(input(6, 10, { deltaMode: 1 }))).toEqual({ direction: 'next', progress: 1, switchTo: 'next' })
    const pages = new SectionOverscrollTracker()
    expect(pages.wheel(input(-0.5, 0, { deltaMode: 2 }))).toEqual({ direction: 'previous', progress: 1, switchTo: 'previous' })
  })

  it('requires the corresponding edge and locks fine deltas after normal scrolling until a new stream', () => {
    const tracker = new SectionOverscrollTracker({ thresholdPx: 300 })
    expect(tracker.wheel(input(20, 0, { atBottom: false }))).toEqual(idle)
    expect(tracker.wheel(input(20, 10))).toEqual(idle)
    expect(tracker.wheel(input(-20, 20))).toEqual(idle)
    expect(tracker.wheel(input(-30, 20 + SECTION_OVERSCROLL_IDLE_MS, { atTop: true }))).toEqual({ direction: 'previous', progress: 30 / 300, switchTo: null })
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
