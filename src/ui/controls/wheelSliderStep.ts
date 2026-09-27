import { roundNumericValue, type NumericStep } from './numericInputDraft'

/** Nominal CSS-pixel distance of one mouse-wheel notch (and of accumulated fine deltas per step). */
export const WHEEL_NOTCH_PX = 100
/**
 * Events at least this large are treated as discrete notches. Notch size in CSS
 * px shrinks with display scaling (Chromium reports 80 at 125%), while precision
 * trackpads emit many smaller deltas.
 */
export const WHEEL_DISCRETE_MIN_PX = 40
/** `WheelEvent.DOM_DELTA_LINE` distance; a typical notch scrolls three lines. */
export const WHEEL_LINE_PX = WHEEL_NOTCH_PX / 3
/** Shift multiplies the wheel step for coarse adjustment. */
export const WHEEL_COARSE_MULTIPLIER = 10

const MIN_ANY_STEP = 0.01
const MAX_ANY_STEP = 1
const NICE_FACTORS = [1, 2, 5, 10]

/**
 * Value change per wheel step. Numeric steps are used as-is; `step="any"` picks
 * the smallest 1-2-5 value covering ~1/100 of the range, bounded to [0.01, 1].
 */
export function wheelStepSize(min: number, max: number, step: NumericStep, coarse = false): number {
  const base = step === 'any' ? anyStepSize(max - min) : step
  return coarse ? base * WHEEL_COARSE_MULTIPLIER : base
}

function anyStepSize(range: number): number {
  const target = range / 100
  if (!Number.isFinite(target) || target <= MIN_ANY_STEP) return MIN_ANY_STEP
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const nice = NICE_FACTORS.map((factor) => factor * magnitude).find((candidate) => candidate >= target) ?? target
  return roundNumericValue(Math.min(MAX_ANY_STEP, nice), 2)
}

/**
 * Signed wheel distance in pixels where positive means "increase": wheel up or
 * right. The dominant axis wins so Shift+wheel (horizontal on Windows) works.
 */
export function wheelIncreasePixels(deltaX: number, deltaY: number, deltaMode: number): number {
  const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? -deltaY : deltaX
  if (deltaMode === 1) return delta * WHEEL_LINE_PX
  if (deltaMode === 2) return Math.sign(delta) * WHEEL_NOTCH_PX
  return delta
}

/**
 * Convert wheel distance into whole steps. Notch-sized events step immediately
 * (at least one step each); small trackpad deltas accumulate to one notch.
 * Reversing direction discards the opposite remainder.
 */
export function consumeWheelSteps(accumulated: number, delta: number): { steps: number; remainder: number } {
  if (Math.abs(delta) >= WHEEL_DISCRETE_MIN_PX) {
    return { steps: Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / WHEEL_NOTCH_PX)), remainder: 0 }
  }
  const start = Math.sign(accumulated) !== 0 && Math.sign(accumulated) !== Math.sign(delta) ? 0 : accumulated
  const total = start + delta
  const steps = Math.trunc(total / WHEEL_NOTCH_PX) + 0
  return { steps, remainder: total - steps * WHEEL_NOTCH_PX + 0 }
}
