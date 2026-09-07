import type { FaceModel } from '../core/model'
import {
  expandAutoBlinkEvents,
  isAutoBlinkControlAction,
  normalizeAutoBlinkDefinition,
  type AutoBlinkDefinition,
  type NormalizedAutoBlinkDefinition,
} from './autoBlink'
import { applyEasing, isEasingId, type EasingId } from './easing'
import {
  cloneFaceModel,
  type AnimationChannelResolver,
  type JsonObject,
  type JsonValue,
  type NormalizedRuntimeAnimationEvent,
} from './runtime'

export const EYE_OPENNESS_KIND = 'eye-openness' as const

export const EYE_OPENNESS_STATES = ['open', 'closed', 'sleep'] as const
export type EyeOpennessState = typeof EYE_OPENNESS_STATES[number]

export const EYE_OPENNESS_ACTIONS = [
  'blink',
  'wink-left',
  'wink-right',
  'open',
  'close',
  'sleep',
] as const
export type EyeOpennessAction = typeof EYE_OPENNESS_ACTIONS[number]

export const DEFAULT_EYE_OPENNESS_TIMING = {
  closeDurationMs: 80,
  holdDurationMs: 20,
  openDurationMs: 120,
  easing: 'ease-in-out' as EasingId,
  closedScale: 0,
} as const

/** Serializable authored defaults/state for the eye-openness channel. */
export type EyeOpennessDefinition = {
  kind: typeof EYE_OPENNESS_KIND
  state?: EyeOpennessState
  closeDurationMs?: number
  holdDurationMs?: number
  openDurationMs?: number
  easing?: EasingId
  closedScale?: number
  autoBlink?: AutoBlinkDefinition
}

export type NormalizedEyeOpennessDefinition = {
  kind: typeof EYE_OPENNESS_KIND
  state: EyeOpennessState
  closeDurationMs: number
  holdDurationMs: number
  openDurationMs: number
  easing: EasingId
  closedScale: number
  autoBlink?: NormalizedAutoBlinkDefinition
}

export type ResolvedEyeOpenness = {
  left: number
  right: number
  state: EyeOpennessState
}

type EyeSide = 'left' | 'right'

type EyeTiming = {
  closeDurationMs: number
  holdDurationMs: number
  openDurationMs: number
  easing: EasingId
  closedScale: number
}

type SteadyMotion = {
  type: 'steady'
  value: number
}

type TransitionMotion = {
  type: 'transition'
  startTimeMs: number
  from: number
  to: number
  durationMs: number
  easing: EasingId
}

type BlinkMotion = {
  type: 'blink'
  startTimeMs: number
  from: number
  closeDurationMs: number
  holdDurationMs: number
  openDurationMs: number
  easing: EasingId
  closedScale: number
}

type EyeMotion = SteadyMotion | TransitionMotion | BlinkMotion

type EyeTrack = {
  motion: EyeMotion
  persistentState: EyeOpennessState
}

type EyePair = Record<EyeSide, EyeTrack>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonNegativeFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function opennessValue(value: unknown, label: string): number {
  const normalized = nonNegativeFinite(value, label)
  if (normalized > 1) throw new RangeError(`${label} must be between 0 and 1`)
  return normalized
}

function isState(value: unknown): value is EyeOpennessState {
  return typeof value === 'string' && (EYE_OPENNESS_STATES as readonly string[]).includes(value)
}

function isAction(value: string): value is EyeOpennessAction {
  return (EYE_OPENNESS_ACTIONS as readonly string[]).includes(value)
}

function readEasing(value: unknown, label: string): EasingId {
  if (typeof value !== 'string' || !isEasingId(value)) {
    throw new RangeError(`${label} must be a supported easing id`)
  }
  return value
}

export function normalizeEyeOpennessDefinition(value: unknown): NormalizedEyeOpennessDefinition {
  if (!isRecord(value)) throw new TypeError('Eye openness definition must be an object')
  if (value.kind !== EYE_OPENNESS_KIND) {
    throw new RangeError(`Unsupported eye openness kind: ${String(value.kind)}`)
  }

  const state = value.state ?? 'open'
  if (!isState(state)) throw new RangeError(`Unsupported eye openness state: ${String(state)}`)

  return {
    kind: EYE_OPENNESS_KIND,
    state,
    closeDurationMs: value.closeDurationMs === undefined
      ? DEFAULT_EYE_OPENNESS_TIMING.closeDurationMs
      : nonNegativeFinite(value.closeDurationMs, 'Eye openness closeDurationMs'),
    holdDurationMs: value.holdDurationMs === undefined
      ? DEFAULT_EYE_OPENNESS_TIMING.holdDurationMs
      : nonNegativeFinite(value.holdDurationMs, 'Eye openness holdDurationMs'),
    openDurationMs: value.openDurationMs === undefined
      ? DEFAULT_EYE_OPENNESS_TIMING.openDurationMs
      : nonNegativeFinite(value.openDurationMs, 'Eye openness openDurationMs'),
    easing: value.easing === undefined
      ? DEFAULT_EYE_OPENNESS_TIMING.easing
      : readEasing(value.easing, 'Eye openness easing'),
    closedScale: value.closedScale === undefined
      ? DEFAULT_EYE_OPENNESS_TIMING.closedScale
      : opennessValue(value.closedScale, 'Eye openness closedScale'),
    ...(value.autoBlink === undefined
      ? {}
      : { autoBlink: normalizeAutoBlinkDefinition(value.autoBlink) }),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function transitionValue(
  startTimeMs: number,
  durationMs: number,
  from: number,
  to: number,
  easing: EasingId,
  timeMs: number,
): number {
  if (timeMs <= startTimeMs) return from
  if (durationMs === 0 || timeMs >= startTimeMs + durationMs) return to
  return lerp(from, to, applyEasing(easing, (timeMs - startTimeMs) / durationMs))
}

function sampleMotion(motion: EyeMotion, timeMs: number): number {
  if (motion.type === 'steady') return motion.value
  if (motion.type === 'transition') {
    return clamp01(transitionValue(
      motion.startTimeMs,
      motion.durationMs,
      motion.from,
      motion.to,
      motion.easing,
      timeMs,
    ))
  }

  const closeEnd = motion.startTimeMs + motion.closeDurationMs
  const holdEnd = closeEnd + motion.holdDurationMs
  const openEnd = holdEnd + motion.openDurationMs

  if (timeMs <= closeEnd) {
    return clamp01(transitionValue(
      motion.startTimeMs,
      motion.closeDurationMs,
      motion.from,
      motion.closedScale,
      motion.easing,
      timeMs,
    ))
  }
  if (timeMs <= holdEnd) return motion.closedScale
  if (timeMs <= openEnd) {
    return clamp01(transitionValue(
      holdEnd,
      motion.openDurationMs,
      motion.closedScale,
      1,
      motion.easing,
      timeMs,
    ))
  }
  return 1
}

function timingFromPayload(
  payload: JsonObject | undefined,
  fallback: EyeTiming,
): EyeTiming {
  if (payload === undefined) return fallback

  return {
    closeDurationMs: payload.closeDurationMs === undefined
      ? fallback.closeDurationMs
      : nonNegativeFinite(payload.closeDurationMs, 'Eye openness event closeDurationMs'),
    holdDurationMs: payload.holdDurationMs === undefined
      ? fallback.holdDurationMs
      : nonNegativeFinite(payload.holdDurationMs, 'Eye openness event holdDurationMs'),
    openDurationMs: payload.openDurationMs === undefined
      ? fallback.openDurationMs
      : nonNegativeFinite(payload.openDurationMs, 'Eye openness event openDurationMs'),
    easing: payload.easing === undefined
      ? fallback.easing
      : readEasing(payload.easing, 'Eye openness event easing'),
    closedScale: payload.closedScale === undefined
      ? fallback.closedScale
      : opennessValue(payload.closedScale, 'Eye openness event closedScale'),
  }
}

function initialTrack(state: EyeOpennessState, closedScale: number): EyeTrack {
  return {
    motion: { type: 'steady', value: state === 'open' ? 1 : closedScale },
    persistentState: state,
  }
}

function beginPersistentTransition(
  track: EyeTrack,
  state: EyeOpennessState,
  startTimeMs: number,
  timing: EyeTiming,
): EyeTrack {
  const from = sampleMotion(track.motion, startTimeMs)
  const to = state === 'open' ? 1 : timing.closedScale
  return {
    persistentState: state,
    motion: {
      type: 'transition',
      startTimeMs,
      from,
      to,
      durationMs: state === 'open' ? timing.openDurationMs : timing.closeDurationMs,
      easing: timing.easing,
    },
  }
}

function beginBlink(
  track: EyeTrack,
  startTimeMs: number,
  timing: EyeTiming,
): EyeTrack {
  if (track.persistentState !== 'open') return track
  return {
    ...track,
    motion: {
      type: 'blink',
      startTimeMs,
      from: sampleMotion(track.motion, startTimeMs),
      closeDurationMs: timing.closeDurationMs,
      holdDurationMs: timing.holdDurationMs,
      openDurationMs: timing.openDurationMs,
      easing: timing.easing,
      closedScale: timing.closedScale,
    },
  }
}

function affectedSides(action: EyeOpennessAction): readonly EyeSide[] {
  if (action === 'wink-left') return ['left']
  if (action === 'wink-right') return ['right']
  return ['left', 'right']
}

function applyEvent(
  tracks: EyePair,
  event: NormalizedRuntimeAnimationEvent,
  fallbackTiming: EyeTiming,
): void {
  if (!isAction(event.action)) {
    throw new RangeError(`Unsupported eye openness action: ${event.action}`)
  }
  const timing = timingFromPayload(event.payload, fallbackTiming)
  const sides = affectedSides(event.action)

  for (const side of sides) {
    const current = tracks[side]
    switch (event.action) {
      case 'blink':
      case 'wink-left':
      case 'wink-right':
        tracks[side] = beginBlink(current, event.startTimeMs, timing)
        break
      case 'open':
        tracks[side] = beginPersistentTransition(current, 'open', event.startTimeMs, timing)
        break
      case 'close':
        tracks[side] = beginPersistentTransition(current, 'closed', event.startTimeMs, timing)
        break
      case 'sleep':
        tracks[side] = beginPersistentTransition(current, 'sleep', event.startTimeMs, timing)
        break
    }
  }
}

function definitionFromChannel(value: JsonValue | undefined): NormalizedEyeOpennessDefinition {
  if (value === undefined) {
    return normalizeEyeOpennessDefinition({ kind: EYE_OPENNESS_KIND })
  }
  return normalizeEyeOpennessDefinition(value)
}

/**
 * Resolve both eye openness values from authored state + explicit runtime event log.
 * Sampling replays only deterministic event records, never browser/render frames.
 */
export function resolveEyeOpenness(
  definition: EyeOpennessDefinition | NormalizedEyeOpennessDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
): ResolvedEyeOpenness {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new RangeError('Eye openness sample time must be finite and non-negative')
  }
  const normalized = normalizeEyeOpennessDefinition(definition)
  const timing: EyeTiming = {
    closeDurationMs: normalized.closeDurationMs,
    holdDurationMs: normalized.holdDurationMs,
    openDurationMs: normalized.openDurationMs,
    easing: normalized.easing,
    closedScale: normalized.closedScale,
  }
  const tracks: EyePair = {
    left: initialTrack(normalized.state, normalized.closedScale),
    right: initialTrack(normalized.state, normalized.closedScale),
  }

  for (const event of events) {
    if (event.channel !== 'eye-openness' || event.startTimeMs > timeMs) continue
    if (isAutoBlinkControlAction(event.action)) continue
    applyEvent(tracks, event, timing)
  }

  return {
    left: sampleMotion(tracks.left.motion, timeMs),
    right: sampleMotion(tracks.right.motion, timeMs),
    state: tracks.left.persistentState === tracks.right.persistentState
      ? tracks.left.persistentState
      : 'open',
  }
}

/**
 * Scale eye height around each eye's existing center. Because FaceModel positions
 * are center coordinates, reducing height leaves the vertical center unchanged.
 */
export function applyEyeOpenness(
  model: FaceModel,
  openness: Pick<ResolvedEyeOpenness, 'left' | 'right'>,
): FaceModel {
  const result = cloneFaceModel(model)
  result.leftEye.geometry.height *= clamp01(openness.left)
  result.rightEye.geometry.height *= clamp01(openness.right)
  return result
}

export const eyeOpennessChannelResolver: AnimationChannelResolver = ({
  model,
  channelDefinition,
  context,
  events,
}) => {
  const definition = definitionFromChannel(channelDefinition)
  const expandedEvents = expandAutoBlinkEvents(
    definition.autoBlink ?? normalizeAutoBlinkDefinition({}),
    events,
    context.timeMs,
    context.seed,
  )
  return applyEyeOpenness(model, resolveEyeOpenness(definition, expandedEvents, context.timeMs))
}
