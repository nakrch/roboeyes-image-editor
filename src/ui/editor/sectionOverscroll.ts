import { WHEEL_DISCRETE_MIN_PX, WHEEL_LINE_PX } from '../controls/wheelSliderStep'

/** Three notches at 100% display scaling (100px) or 125% (80px). */
export const SECTION_OVERSCROLL_THRESHOLD_PX = 240
export const SECTION_OVERSCROLL_IDLE_MS = 350

export type OverscrollDirection = 'next' | 'previous'
export type SectionOverscrollInput = {
  deltaX: number
  deltaY: number
  deltaMode: number
  atTop: boolean
  atBottom: boolean
  pageHeightPx: number
  timeStamp: number
}
export type SectionOverscrollState = {
  direction: OverscrollDirection | null
  progress: number
  switchTo: OverscrollDirection | null
}

const idle: SectionOverscrollState = { direction: null, progress: 0, switchTo: null }

/**
 * Tracks one wheel stream. Overscroll accumulates only at the matching edge and restarts whenever
 * content scrolls. Fine (trackpad-sized) deltas are additionally locked after normal scrolling or a
 * switch until the stream pauses, so fling momentum cannot punch through an edge or chain switches.
 * Notch-sized mouse-wheel events have no momentum and ignore the lock, so a continuous spin keeps
 * flowing: scroll the content, then a fixed detent at each edge.
 */
export class SectionOverscrollTracker {
  private readonly thresholdPx: number
  private readonly idleMs: number
  private lastTimeStamp: number | null = null
  private locked = false
  private direction: OverscrollDirection | null = null
  private accumulated = 0

  constructor(options: { thresholdPx?: number; idleMs?: number } = {}) {
    this.thresholdPx = options.thresholdPx ?? SECTION_OVERSCROLL_THRESHOLD_PX
    this.idleMs = options.idleMs ?? SECTION_OVERSCROLL_IDLE_MS
  }

  wheel(input: SectionOverscrollInput): SectionOverscrollState {
    if (this.lastTimeStamp === null || input.timeStamp - this.lastTimeStamp >= this.idleMs) {
      this.reset()
    }
    this.lastTimeStamp = input.timeStamp

    if (input.deltaY === 0 || Math.abs(input.deltaX) > Math.abs(input.deltaY)) return idle

    const pixels = Math.abs(input.deltaY) * (input.deltaMode === 1 ? WHEEL_LINE_PX : input.deltaMode === 2 ? input.pageHeightPx : 1)
    if (this.locked && pixels < WHEEL_DISCRETE_MIN_PX) return idle

    const direction: OverscrollDirection = input.deltaY > 0 ? 'next' : 'previous'
    if (direction === 'next' ? !input.atBottom : !input.atTop) {
      // Normal content scrolling restarts the detent and disarms fine deltas until the next stream.
      this.locked = true
      this.direction = null
      this.accumulated = 0
      return idle
    }
    if (this.direction !== direction) {
      this.direction = direction
      this.accumulated = 0
    }
    this.accumulated += pixels
    if (this.accumulated >= this.thresholdPx) {
      this.accumulated = 0
      this.direction = null
      // Lock fine deltas for the rest of this stream, including trackpad momentum.
      this.locked = true
      return { direction, progress: 1, switchTo: direction }
    }
    return { direction, progress: Math.min(1, this.accumulated / this.thresholdPx), switchTo: null }
  }

  /** Clear accumulation and lock without arming the post-switch lock. */
  reset(): void {
    this.lastTimeStamp = null
    this.locked = false
    this.direction = null
    this.accumulated = 0
  }
}
