import type { FaceModel } from '../core/model'
import { normalizeAnimationSeed } from './random'

export const ANIMATION_DEFINITION_VERSION = 1 as const

export const ANIMATION_COMPOSITION_ORDER = [
  'base',
  'state-transition',
  'gaze-pose',
  'eye-openness',
  'motion-offset',
  'transient-effect',
] as const

export const ANIMATION_RUNTIME_CHANNELS = [
  'state-transition',
  'gaze-pose',
  'eye-openness',
  'motion-offset',
  'transient-effect',
] as const

export type AnimationCompositionChannel = typeof ANIMATION_COMPOSITION_ORDER[number]
export type AnimationRuntimeChannel = typeof ANIMATION_RUNTIME_CHANNELS[number]

export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

/**
 * Phase 3 authored-data envelope. Individual channel schemas are introduced by
 * their owning issues while the envelope remains JSON-safe and versioned.
 */
export type AnimationDefinition = {
  version: typeof ANIMATION_DEFINITION_VERSION
  enabled: boolean
  channels?: Partial<Record<AnimationRuntimeChannel, JsonValue>>
}

export const EMPTY_ANIMATION_DEFINITION: Readonly<AnimationDefinition> = {
  version: ANIMATION_DEFINITION_VERSION,
  enabled: false,
}

export type AnimationFrameContext = {
  /** Explicit logical animation time. Fractional milliseconds are allowed. */
  timeMs: number
  /** Stable unsigned 32-bit seed. */
  seed: number
}

/**
 * Ephemeral playback event. It is explicit plain data, but is intentionally
 * separate from authored animation definitions and preset persistence.
 */
export type RuntimeAnimationEvent = {
  id: string
  channel: AnimationRuntimeChannel
  action: string
  startTimeMs: number
  /** Monotonic caller-owned ordering for otherwise simultaneous events. */
  order: number
  /** Higher priority wins after events at the same channel/start time. */
  priority?: number
  payload?: JsonObject
}

export type NormalizedRuntimeAnimationEvent = Omit<RuntimeAnimationEvent, 'priority'> & {
  priority: number
}

export type AnimationChannelResolverInput = {
  model: FaceModel
  definition: AnimationDefinition
  channelDefinition: JsonValue | undefined
  context: AnimationFrameContext
  events: readonly NormalizedRuntimeAnimationEvent[]
}

export type AnimationChannelResolver = (input: AnimationChannelResolverInput) => FaceModel
export type AnimationChannelResolvers = Partial<Record<AnimationRuntimeChannel, AnimationChannelResolver>>

export type EvaluateAnimationFrameInput = {
  baseModel: FaceModel
  definition?: AnimationDefinition
  context: AnimationFrameContext
  runtimeEvents?: readonly RuntimeAnimationEvent[]
  /** Runtime implementation registry; authored data never stores these functions. */
  channelResolvers?: AnimationChannelResolvers
}

export type ResolvedAnimationFrame = {
  model: FaceModel
  context: AnimationFrameContext
  /** Deterministically ordered events whose start time is not in the future. */
  runtimeEvents: readonly NormalizedRuntimeAnimationEvent[]
}

function isRuntimeChannel(value: string): value is AnimationRuntimeChannel {
  return (ANIMATION_RUNTIME_CHANNELS as readonly string[]).includes(value)
}

function normalizeTimeMs(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function normalizeOrder(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
  return value
}

function normalizePriority(value: number | undefined): number {
  const normalized = value ?? 0
  if (!Number.isSafeInteger(normalized)) {
    throw new RangeError('Runtime event priority must be a safe integer')
  }
  return normalized
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).every(isJsonValue)
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as T
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as T
  }
  return value
}

export function normalizeAnimationDefinition(definition: AnimationDefinition): AnimationDefinition {
  if (definition.version !== ANIMATION_DEFINITION_VERSION) {
    throw new RangeError(`Unsupported animation definition version: ${String(definition.version)}`)
  }
  if (typeof definition.enabled !== 'boolean') {
    throw new TypeError('Animation definition enabled must be boolean')
  }

  let channels: AnimationDefinition['channels']
  if (definition.channels !== undefined) {
    if (definition.channels === null || typeof definition.channels !== 'object' || Array.isArray(definition.channels)) {
      throw new TypeError('Animation definition channels must be an object')
    }
    channels = {}
    for (const [channel, channelDefinition] of Object.entries(definition.channels)) {
      if (!isRuntimeChannel(channel)) {
        throw new RangeError(`Unsupported animation channel: ${channel}`)
      }
      if (!isJsonValue(channelDefinition)) {
        throw new TypeError(`Animation channel ${channel} must contain JSON-safe finite data`)
      }
      channels[channel] = cloneJsonValue(channelDefinition)
    }
  }

  return channels === undefined
    ? { version: ANIMATION_DEFINITION_VERSION, enabled: definition.enabled }
    : { version: ANIMATION_DEFINITION_VERSION, enabled: definition.enabled, channels }
}

export function createAnimationFrameContext(timeMs: number, seed: number): AnimationFrameContext {
  return {
    timeMs: normalizeTimeMs(timeMs, 'Animation time'),
    seed: normalizeAnimationSeed(seed),
  }
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function channelIndex(channel: AnimationRuntimeChannel): number {
  return ANIMATION_RUNTIME_CHANNELS.indexOf(channel)
}

/**
 * Stable event order:
 * start time -> composition channel -> priority -> caller order -> id.
 * Applying in this order means higher priority/order wins within a conflict.
 */
export function compareRuntimeAnimationEvents(
  left: NormalizedRuntimeAnimationEvent,
  right: NormalizedRuntimeAnimationEvent,
): number {
  return left.startTimeMs - right.startTimeMs ||
    channelIndex(left.channel) - channelIndex(right.channel) ||
    left.priority - right.priority ||
    left.order - right.order ||
    compareStrings(left.id, right.id)
}

export function normalizeRuntimeAnimationEvents(
  events: readonly RuntimeAnimationEvent[],
): NormalizedRuntimeAnimationEvent[] {
  const ids = new Set<string>()
  const normalized = events.map((event) => {
    if (event.id.length === 0) throw new RangeError('Runtime event id must not be empty')
    if (ids.has(event.id)) throw new RangeError(`Duplicate runtime event id: ${event.id}`)
    ids.add(event.id)
    if (!isRuntimeChannel(event.channel)) {
      throw new RangeError(`Unsupported runtime event channel: ${String(event.channel)}`)
    }
    if (event.action.length === 0) throw new RangeError('Runtime event action must not be empty')
    if (event.payload !== undefined && !isJsonValue(event.payload)) {
      throw new TypeError(`Runtime event ${event.id} payload must be JSON-safe finite data`)
    }

    return {
      ...event,
      startTimeMs: normalizeTimeMs(event.startTimeMs, `Runtime event ${event.id} start time`),
      order: normalizeOrder(event.order, `Runtime event ${event.id} order`),
      priority: normalizePriority(event.priority),
      payload: event.payload === undefined ? undefined : cloneJsonValue(event.payload),
    }
  })
  return normalized.sort(compareRuntimeAnimationEvents)
}

export function runtimeEventsAtOrBefore(
  events: readonly RuntimeAnimationEvent[],
  timeMs: number,
): NormalizedRuntimeAnimationEvent[] {
  const sampleTime = normalizeTimeMs(timeMs, 'Animation time')
  return normalizeRuntimeAnimationEvents(events).filter((event) => event.startTimeMs <= sampleTime)
}

/**
 * Default same-channel conflict helper. Later start times retrigger/replace
 * earlier events; for equal start times, higher priority/order/id wins.
 */
export function resolveDominantRuntimeEvent(
  events: readonly RuntimeAnimationEvent[],
  channel: AnimationRuntimeChannel,
  timeMs: number,
): NormalizedRuntimeAnimationEvent | undefined {
  const candidates = runtimeEventsAtOrBefore(events, timeMs).filter((event) => event.channel === channel)
  return candidates.at(-1)
}

export function cloneFaceModel(model: FaceModel): FaceModel {
  const expression = { ...model.expression }
  if (model.expression.leftEye !== undefined) expression.leftEye = { ...model.expression.leftEye }
  if (model.expression.rightEye !== undefined) expression.rightEye = { ...model.expression.rightEye }

  return {
    canvas: { ...model.canvas },
    leftEye: {
      geometry: {
        ...model.leftEye.geometry,
        position: { ...model.leftEye.geometry.position },
      },
    },
    rightEye: {
      geometry: {
        ...model.rightEye.geometry,
        position: { ...model.rightEye.geometry.position },
      },
    },
    gaze: { ...model.gaze },
    expression,
    colors: { ...model.colors },
  }
}

/**
 * Deterministically sample one frame. Channel resolvers execute only in the
 * documented composition order and receive events for their own channel.
 */
export function evaluateAnimationFrame(input: EvaluateAnimationFrameInput): ResolvedAnimationFrame {
  const definition = normalizeAnimationDefinition(input.definition ?? EMPTY_ANIMATION_DEFINITION)
  const context = createAnimationFrameContext(input.context.timeMs, input.context.seed)
  const runtimeEvents = runtimeEventsAtOrBefore(input.runtimeEvents ?? [], context.timeMs)
  let model = cloneFaceModel(input.baseModel)

  for (const channel of ANIMATION_RUNTIME_CHANNELS) {
    const resolver = input.channelResolvers?.[channel]
    if (resolver === undefined) continue

    const channelDefinition = definition.enabled ? definition.channels?.[channel] : undefined
    const channelEvents = runtimeEvents.filter((event) => event.channel === channel)
    if (channelDefinition === undefined && channelEvents.length === 0) continue

    model = cloneFaceModel(resolver({
      model: cloneFaceModel(model),
      definition,
      channelDefinition,
      context,
      events: channelEvents,
    }))
  }

  return { model, context, runtimeEvents }
}
