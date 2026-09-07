import { gazeLimits, type FaceModel } from '../core/model'
import { normalizeAnimationSeed, sampleRandomRange } from './random'
import {
  cloneFaceModel,
  type AnimationChannelResolver,
  type JsonObject,
  type NormalizedRuntimeAnimationEvent,
} from './runtime'

export const MOTION_OFFSET_KIND = 'motion-offset' as const
export const MOTION_AXES = ['x', 'y'] as const
export const MOTION_WAVEFORMS = ['square', 'sine', 'triangle', 'jitter'] as const
export const MOTION_OFFSET_ACTIONS = ['motion', 'confused', 'laugh', 'motion-stop'] as const

export type MotionAxis = typeof MOTION_AXES[number]
export type MotionWaveform = typeof MOTION_WAVEFORMS[number]
export type MotionOffsetAction = typeof MOTION_OFFSET_ACTIONS[number]

export type MotionPrimitiveDefinition = {
  axis: MotionAxis
  /** Peak displacement in canvas units. */
  amplitude: number
  /** One-shot lifetime. The offset resolves to zero at and after the end. */
  durationMs: number
  /** Full waveform period in milliseconds. */
  periodMs: number
  /** Initial waveform phase in cycles. */
  phase?: number
  waveform?: MotionWaveform
}

export type NormalizedMotionPrimitiveDefinition = {
  axis: MotionAxis
  amplitude: number
  durationMs: number
  periodMs: number
  phase: number
  waveform: MotionWaveform
}

export type ResolvedMotionOffset = {
  x: number
  y: number
  active: boolean
  sourceEventId?: string
}

export const DEFAULT_MOTION_PRIMITIVE: Readonly<NormalizedMotionPrimitiveDefinition> = {
  axis: 'x',
  amplitude: 2,
  durationMs: 500,
  periodMs: 40,
  phase: 0,
  waveform: 'square',
}

/**
 * RoboEyes V1.1.1 defaults. The reference alternates every rendered frame;
 * its default 50 fps therefore corresponds to a 40 ms full square-wave cycle.
 */
export const DEFAULT_CONFUSED_MOTION: Readonly<NormalizedMotionPrimitiveDefinition> = {
  axis: 'x',
  amplitude: 20,
  durationMs: 500,
  periodMs: 40,
  phase: 0,
  waveform: 'square',
}

export const DEFAULT_LAUGH_MOTION: Readonly<NormalizedMotionPrimitiveDefinition> = {
  axis: 'y',
  amplitude: 5,
  durationMs: 500,
  periodMs: 40,
  phase: 0,
  waveform: 'square',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function nonNegativeFinite(value: unknown, label: string): number {
  const result = finiteNumber(value, label)
  if (result < 0) throw new RangeError(`${label} must be non-negative`)
  return result
}

function positiveFinite(value: unknown, label: string): number {
  const result = nonNegativeFinite(value, label)
  if (result <= 0) throw new RangeError(`${label} must be greater than zero`)
  return result
}

function isAxis(value: unknown): value is MotionAxis {
  return typeof value === 'string' && (MOTION_AXES as readonly string[]).includes(value)
}

function isWaveform(value: unknown): value is MotionWaveform {
  return typeof value === 'string' && (MOTION_WAVEFORMS as readonly string[]).includes(value)
}

function normalizePhase(value: number): number {
  const wrapped = value % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

export function normalizeMotionPrimitiveDefinition(
  value: unknown,
  fallback: NormalizedMotionPrimitiveDefinition = DEFAULT_MOTION_PRIMITIVE,
): NormalizedMotionPrimitiveDefinition {
  if (!isRecord(value)) throw new TypeError('Motion primitive definition must be an object')

  const axis = value.axis ?? fallback.axis
  if (!isAxis(axis)) throw new RangeError(`Unsupported motion axis: ${String(axis)}`)
  const waveform = value.waveform ?? fallback.waveform
  if (!isWaveform(waveform)) throw new RangeError(`Unsupported motion waveform: ${String(waveform)}`)

  return {
    axis,
    amplitude: value.amplitude === undefined
      ? fallback.amplitude
      : nonNegativeFinite(value.amplitude, 'Motion amplitude'),
    durationMs: value.durationMs === undefined
      ? fallback.durationMs
      : nonNegativeFinite(value.durationMs, 'Motion durationMs'),
    periodMs: value.periodMs === undefined
      ? fallback.periodMs
      : positiveFinite(value.periodMs, 'Motion periodMs'),
    phase: normalizePhase(value.phase === undefined
      ? fallback.phase
      : finiteNumber(value.phase, 'Motion phase')),
    waveform,
  }
}

function payloadPrimitive(
  payload: JsonObject | undefined,
  fallback: NormalizedMotionPrimitiveDefinition,
): NormalizedMotionPrimitiveDefinition {
  return normalizeMotionPrimitiveDefinition(payload ?? {}, fallback)
}

function waveformUnit(
  definition: NormalizedMotionPrimitiveDefinition,
  elapsedMs: number,
  seed: number,
  stream: string,
): number {
  const cycles = elapsedMs / definition.periodMs + definition.phase
  const phase = ((cycles % 1) + 1) % 1

  switch (definition.waveform) {
    case 'square':
      return phase < 0.5 ? -1 : 1
    case 'sine':
      return Math.sin(phase * Math.PI * 2)
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5)
    case 'jitter': {
      const sampleIndex = Math.max(0, Math.floor(cycles))
      return sampleRandomRange(seed, stream, sampleIndex, -1, 1)
    }
  }
}

/** Sample one generic one-shot motion primitive at explicit logical time. */
export function sampleMotionPrimitive(
  definitionInput: MotionPrimitiveDefinition | NormalizedMotionPrimitiveDefinition,
  startTimeMs: number,
  timeMs: number,
  seed = 0,
  stream = 'motion-offset',
): ResolvedMotionOffset {
  const definition = normalizeMotionPrimitiveDefinition(definitionInput)
  const start = nonNegativeFinite(startTimeMs, 'Motion startTimeMs')
  const sampleTime = nonNegativeFinite(timeMs, 'Motion sample time')
  const normalizedSeed = normalizeAnimationSeed(seed)

  if (sampleTime < start || definition.durationMs === 0 || sampleTime >= start + definition.durationMs) {
    return { x: 0, y: 0, active: false }
  }

  const value = definition.amplitude * waveformUnit(
    definition,
    sampleTime - start,
    normalizedSeed,
    stream,
  )
  return definition.axis === 'x'
    ? { x: value, y: 0, active: true }
    : { x: 0, y: value, active: true }
}

export function isMotionOffsetAction(action: string): action is MotionOffsetAction {
  return (MOTION_OFFSET_ACTIONS as readonly string[]).includes(action)
}

function primitiveForEvent(event: NormalizedRuntimeAnimationEvent): NormalizedMotionPrimitiveDefinition | undefined {
  switch (event.action) {
    case 'motion':
      return payloadPrimitive(event.payload, DEFAULT_MOTION_PRIMITIVE)
    case 'confused':
      return payloadPrimitive(event.payload, DEFAULT_CONFUSED_MOTION)
    case 'laugh':
      return payloadPrimitive(event.payload, DEFAULT_LAUGH_MOTION)
    case 'motion-stop':
      return undefined
    default:
      throw new RangeError(`Unsupported motion-offset action: ${event.action}`)
  }
}

/**
 * Latest trigger wins. Retrigger starts a fresh waveform phase at the new event
 * timestamp; stop clears the offset immediately. Completed one-shots contribute
 * zero without leaving mutable state behind.
 */
export function resolveMotionOffset(
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
  seed: number,
): ResolvedMotionOffset {
  const sampleTime = nonNegativeFinite(timeMs, 'Motion sample time')
  const normalizedSeed = normalizeAnimationSeed(seed)
  const relevant = events.filter((event) =>
    event.channel === 'motion-offset' && event.startTimeMs <= sampleTime,
  )
  const latest = relevant.at(-1)
  if (latest === undefined) return { x: 0, y: 0, active: false }
  if (!isMotionOffsetAction(latest.action)) {
    throw new RangeError(`Unsupported motion-offset action: ${latest.action}`)
  }
  if (latest.action === 'motion-stop') return { x: 0, y: 0, active: false, sourceEventId: latest.id }

  const primitive = primitiveForEvent(latest)
  if (primitive === undefined) return { x: 0, y: 0, active: false, sourceEventId: latest.id }
  return {
    ...sampleMotionPrimitive(
      primitive,
      latest.startTimeMs,
      sampleTime,
      normalizedSeed,
      `motion-offset:${latest.id}`,
    ),
    sourceEventId: latest.id,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Apply transient displacement after gaze/pose without rewriting authored gaze.
 * The offset is clamped to the same canvas-safe visual displacement range that
 * an equivalent gaze delta would have.
 */
export function applyMotionOffset(
  model: FaceModel,
  offset: Pick<ResolvedMotionOffset, 'x' | 'y'>,
): FaceModel {
  const result = cloneFaceModel(model)
  const limits = gazeLimits(model)
  const x = clamp(offset.x, limits.x.min - model.gaze.x, limits.x.max - model.gaze.x)
  const y = clamp(offset.y, limits.y.min - model.gaze.y, limits.y.max - model.gaze.y)

  result.leftEye.geometry.position.x += x
  result.rightEye.geometry.position.x += x
  result.leftEye.geometry.position.y += y
  result.rightEye.geometry.position.y += y
  return result
}

export const motionOffsetChannelResolver: AnimationChannelResolver = ({
  model,
  context,
  events,
}) => applyMotionOffset(model, resolveMotionOffset(events, context.timeMs, context.seed))
