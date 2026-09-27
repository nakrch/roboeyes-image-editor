import { WHEEL_LINE_PX } from '../controls/wheelSliderStep'

/** Three notches at 100% display scaling (100px) or 125% (80px). */
export const SECTION_OVERSCROLL_THRESHOLD_PX = 240
/** A wheel pause at least this long discards partial overscroll. */
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
 * Edge detent for section switching. Overscroll accumulates only while the panel sits at the edge in
 * the wheel direction, and restarts whenever content scrolls, the direction reverses, or the wheel
 * pauses. There is deliberately no post-switch lock: a continuous spin of any delta size keeps
 * flowing through sections, one full detent per edge.
 */
export class SectionOverscrollTracker {
  private readonly thresholdPx: number
  private readonly idleMs: number
  private lastTimeStamp: number | null = null
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

    const direction: OverscrollDirection = input.deltaY > 0 ? 'next' : 'previous'
    if (direction === 'next' ? !input.atBottom : !input.atTop) {
      this.direction = null
      this.accumulated = 0
      return idle
    }
    const pixels = Math.abs(input.deltaY) * (input.deltaMode === 1 ? WHEEL_LINE_PX : input.deltaMode === 2 ? input.pageHeightPx : 1)
    if (this.direction !== direction) {
      this.direction = direction
      this.accumulated = 0
    }
    this.accumulated += pixels
    if (this.accumulated >= this.thresholdPx) {
      this.accumulated = 0
      this.direction = null
      return { direction, progress: 1, switchTo: direction }
    }
    return { direction, progress: Math.min(1, this.accumulated / this.thresholdPx), switchTo: null }
  }

  /** Clear partial overscroll (e.g. after the section changes by click). */
  reset(): void {
    this.lastTimeStamp = null
    this.direction = null
    this.accumulated = 0
  }
}
