import { normalizeAnimationSeed, sampleRandomRange } from './random'

export type DeterministicIntervalSchedule = {
  /** Named random substream. Keep unrelated behaviors on different names. */
  stream: string
  /** Logical schedule origin. Defaults to zero. */
  startTimeMs?: number
  /** Minimum delay between scheduled events. Must be greater than zero. */
  intervalMs: number
  /** Additional deterministic delay sampled from [0, variationMs). Defaults to zero. */
  variationMs?: number
}

function normalizeNonNegativeTime(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function normalizeEventIndex(index: number): number {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('Scheduled event index must be a non-negative safe integer')
  }
  return index
}

function normalizeSchedule(schedule: DeterministicIntervalSchedule): Required<DeterministicIntervalSchedule> {
  if (schedule.stream.length === 0) {
    throw new RangeError('Schedule stream name must not be empty')
  }
  const startTimeMs = normalizeNonNegativeTime(schedule.startTimeMs ?? 0, 'Schedule start time')
  const intervalMs = normalizeNonNegativeTime(schedule.intervalMs, 'Schedule interval')
  const variationMs = normalizeNonNegativeTime(schedule.variationMs ?? 0, 'Schedule variation')
  if (intervalMs <= 0) {
    throw new RangeError('Schedule interval must be greater than zero')
  }
  return { ...schedule, startTimeMs, intervalMs, variationMs }
}

/** Delay preceding one indexed event, independent of render cadence. */
export function scheduledDelayMs(
  schedule: DeterministicIntervalSchedule,
  seed: number,
  eventIndex: number,
): number {
  const normalized = normalizeSchedule(schedule)
  const normalizedSeed = normalizeAnimationSeed(seed)
  const index = normalizeEventIndex(eventIndex)
  return normalized.intervalMs + sampleRandomRange(
    normalizedSeed,
    normalized.stream,
    index,
    0,
    normalized.variationMs,
  )
}

/**
 * Logical time for an indexed event. This walks event indices, not browser
 * frames, so direct seeking does not depend on prior render cadence.
 */
export function scheduledEventTimeMs(
  schedule: DeterministicIntervalSchedule,
  seed: number,
  eventIndex: number,
): number {
  const normalized = normalizeSchedule(schedule)
  const index = normalizeEventIndex(eventIndex)
  let timeMs = normalized.startTimeMs
  for (let cursor = 0; cursor <= index; cursor += 1) {
    timeMs += scheduledDelayMs(normalized, seed, cursor)
  }
  return timeMs
}

/**
 * Return deterministic scheduled events up to an explicit logical timestamp.
 * `maxEvents` prevents accidental unbounded scans for malformed/huge requests.
 */
export function scheduledEventTimesThrough(
  schedule: DeterministicIntervalSchedule,
  seed: number,
  timeMs: number,
  maxEvents = 10_000,
): number[] {
  const normalized = normalizeSchedule(schedule)
  normalizeAnimationSeed(seed)
  const targetTimeMs = normalizeNonNegativeTime(timeMs, 'Schedule sample time')
  if (!Number.isSafeInteger(maxEvents) || maxEvents <= 0) {
    throw new RangeError('maxEvents must be a positive safe integer')
  }

  const result: number[] = []
  let cursorTime = normalized.startTimeMs
  for (let index = 0; index < maxEvents; index += 1) {
    cursorTime += scheduledDelayMs(normalized, seed, index)
    if (cursorTime > targetTimeMs) return result
    result.push(cursorTime)
  }

  const nextTime = cursorTime + scheduledDelayMs(normalized, seed, maxEvents)
  if (nextTime <= targetTimeMs) {
    throw new RangeError(`Schedule exceeds maxEvents (${maxEvents}) before requested time`)
  }
  return result
}
