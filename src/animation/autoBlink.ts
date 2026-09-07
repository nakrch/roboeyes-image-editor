import { normalizeAnimationSeed } from './random'
import { scheduledEventTimesThrough } from './scheduler'
import {
  compareRuntimeAnimationEvents,
  type JsonObject,
  type NormalizedRuntimeAnimationEvent,
} from './runtime'

export const AUTO_BLINK_RANDOM_STREAM = 'auto-blink' as const

export const AUTO_BLINK_CONTROL_ACTIONS = [
  'auto-blink-enable',
  'auto-blink-disable',
] as const
export type AutoBlinkControlAction = typeof AUTO_BLINK_CONTROL_ACTIONS[number]

export const DEFAULT_AUTO_BLINK = {
  enabled: false,
  startTimeMs: 0,
  intervalMs: 1_000,
  variationMs: 4_000,
} as const

/**
 * Scheduled auto-blinks intentionally sort before ordinary manual eye-openness
 * events at the same timestamp. Default-priority manual blink/wink/open/close
 * therefore gets the final say for a simultaneous conflict.
 */
export const AUTO_BLINK_EVENT_PRIORITY = -1_000_000

export type AutoBlinkDefinition = {
  enabled?: boolean
  /** Logical enable/origin time. The first blink occurs after one full sampled delay. */
  startTimeMs?: number
  /** Minimum delay between automatic blinks. Must be greater than zero. */
  intervalMs?: number
  /** Additional seeded delay sampled from [0, variationMs). */
  variationMs?: number
}

export type NormalizedAutoBlinkDefinition = {
  enabled: boolean
  startTimeMs: number
  intervalMs: number
  variationMs: number
}

type AutoBlinkConfig = Pick<NormalizedAutoBlinkDefinition, 'intervalMs' | 'variationMs'>

type AutoBlinkEpoch = AutoBlinkConfig & {
  index: number
  startTimeMs: number
  endTimeMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonNegativeFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function positiveFinite(value: unknown, label: string): number {
  const normalized = nonNegativeFinite(value, label)
  if (normalized <= 0) throw new RangeError(`${label} must be greater than zero`)
  return normalized
}

export function normalizeAutoBlinkDefinition(value: unknown): NormalizedAutoBlinkDefinition {
  if (!isRecord(value)) throw new TypeError('Auto-blink definition must be an object')

  const enabled = value.enabled ?? DEFAULT_AUTO_BLINK.enabled
  if (typeof enabled !== 'boolean') throw new TypeError('Auto-blink enabled must be boolean')

  return {
    enabled,
    startTimeMs: value.startTimeMs === undefined
      ? DEFAULT_AUTO_BLINK.startTimeMs
      : nonNegativeFinite(value.startTimeMs, 'Auto-blink startTimeMs'),
    intervalMs: value.intervalMs === undefined
      ? DEFAULT_AUTO_BLINK.intervalMs
      : positiveFinite(value.intervalMs, 'Auto-blink intervalMs'),
    variationMs: value.variationMs === undefined
      ? DEFAULT_AUTO_BLINK.variationMs
      : nonNegativeFinite(value.variationMs, 'Auto-blink variationMs'),
  }
}

export function isAutoBlinkControlAction(action: string): action is AutoBlinkControlAction {
  return (AUTO_BLINK_CONTROL_ACTIONS as readonly string[]).includes(action)
}

function configFromPayload(payload: JsonObject | undefined, fallback: AutoBlinkConfig): AutoBlinkConfig {
  if (payload === undefined) return fallback
  return {
    intervalMs: payload.intervalMs === undefined
      ? fallback.intervalMs
      : positiveFinite(payload.intervalMs, 'Auto-blink enable intervalMs'),
    variationMs: payload.variationMs === undefined
      ? fallback.variationMs
      : nonNegativeFinite(payload.variationMs, 'Auto-blink enable variationMs'),
  }
}

function buildEpochs(
  definition: NormalizedAutoBlinkDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
): AutoBlinkEpoch[] {
  const controls = events
    .filter((event) =>
      event.channel === 'eye-openness' &&
      event.startTimeMs <= timeMs &&
      isAutoBlinkControlAction(event.action),
    )
    .slice()
    .sort(compareRuntimeAnimationEvents)

  const fallback: AutoBlinkConfig = {
    intervalMs: definition.intervalMs,
    variationMs: definition.variationMs,
  }
  const epochs: AutoBlinkEpoch[] = []
  let nextEpochIndex = 0
  let active: AutoBlinkEpoch | undefined = definition.enabled
    ? {
        index: nextEpochIndex++,
        startTimeMs: definition.startTimeMs,
        ...fallback,
      }
    : undefined

  const finishActive = (endTimeMs: number): void => {
    if (active === undefined) return
    if (endTimeMs > active.startTimeMs) {
      epochs.push({ ...active, endTimeMs })
    }
    active = undefined
  }

  for (const event of controls) {
    if (event.action === 'auto-blink-disable') {
      finishActive(event.startTimeMs)
      continue
    }

    finishActive(event.startTimeMs)
    active = {
      index: nextEpochIndex++,
      startTimeMs: event.startTimeMs,
      ...configFromPayload(event.payload, fallback),
    }
  }

  if (active !== undefined) epochs.push(active)
  return epochs
}

/**
 * Materialize deterministic automatic `blink` events through an explicit time.
 * The scheduler is stateless: direct seek and incremental playback produce the
 * same event list for identical definition/events/time/seed inputs.
 */
export function scheduledAutoBlinkEvents(
  definition: AutoBlinkDefinition | NormalizedAutoBlinkDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
  seed: number,
): NormalizedRuntimeAnimationEvent[] {
  const normalized = normalizeAutoBlinkDefinition(definition)
  const normalizedSeed = normalizeAnimationSeed(seed)
  const sampleTimeMs = nonNegativeFinite(timeMs, 'Auto-blink sample time')
  const epochs = buildEpochs(normalized, events, sampleTimeMs)
  const generated: NormalizedRuntimeAnimationEvent[] = []
  let generatedOrder = 0

  for (const epoch of epochs) {
    const throughTimeMs = Math.min(sampleTimeMs, epoch.endTimeMs ?? sampleTimeMs)
    if (throughTimeMs < epoch.startTimeMs) continue

    const times = scheduledEventTimesThrough({
      stream: `${AUTO_BLINK_RANDOM_STREAM}:epoch-${epoch.index}`,
      startTimeMs: epoch.startTimeMs,
      intervalMs: epoch.intervalMs,
      variationMs: epoch.variationMs,
    }, normalizedSeed, throughTimeMs)

    for (let eventIndex = 0; eventIndex < times.length; eventIndex += 1) {
      const startTimeMs = times[eventIndex]
      if (epoch.endTimeMs !== undefined && startTimeMs >= epoch.endTimeMs) continue
      generated.push({
        id: `@auto-blink/${epoch.index}/${eventIndex}`,
        channel: 'eye-openness',
        action: 'blink',
        startTimeMs,
        order: generatedOrder++,
        priority: AUTO_BLINK_EVENT_PRIORITY,
      })
    }
  }

  return generated.sort(compareRuntimeAnimationEvents)
}

/**
 * Replace auto-blink control records with their deterministic scheduled blink
 * events while preserving all ordinary manual eye-openness events.
 */
export function expandAutoBlinkEvents(
  definition: AutoBlinkDefinition | NormalizedAutoBlinkDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
  seed: number,
): NormalizedRuntimeAnimationEvent[] {
  const sampleTimeMs = nonNegativeFinite(timeMs, 'Auto-blink sample time')
  const manual = events.filter((event) =>
    event.startTimeMs <= sampleTimeMs && !isAutoBlinkControlAction(event.action),
  )
  return [
    ...manual,
    ...scheduledAutoBlinkEvents(definition, events, sampleTimeMs, seed),
  ].sort(compareRuntimeAnimationEvents)
}
