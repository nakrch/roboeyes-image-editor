import {
  gazeLimits,
  isGazeCanvasSafe,
  type FaceModel,
  type NumericRange,
  type Point,
} from '../core/model'
import { isEasingId, type EasingId } from './easing'
import { normalizeAnimationSeed, sampleRandomRange } from './random'
import { scheduledEventTimesThrough } from './scheduler'
import {
  cloneFaceModel,
  compareRuntimeAnimationEvents,
  type AnimationChannelResolver,
  type JsonObject,
  type JsonValue,
  type NormalizedRuntimeAnimationEvent,
} from './runtime'
import {
  createFaceTransition,
  sampleFaceTransition,
  type FaceTransitionDefinition,
} from './transition'

export const IDLE_GAZE_KIND = 'idle-gaze' as const
export const IDLE_GAZE_RANDOM_STREAM = 'idle-gaze' as const

export const IDLE_GAZE_CONTROL_ACTIONS = [
  'idle-gaze-enable',
  'idle-gaze-disable',
] as const
export type IdleGazeControlAction = typeof IDLE_GAZE_CONTROL_ACTIONS[number]

export const DEFAULT_IDLE_GAZE = {
  enabled: false,
  startTimeMs: 0,
  intervalMs: 1_000,
  variationMs: 3_000,
  transitionDurationMs: 350,
  easing: 'ease-in-out' as EasingId,
} as const

export type IdleGazeRange = NumericRange

export type IdleGazeDefinition = {
  kind: typeof IDLE_GAZE_KIND
  enabled?: boolean
  /** Logical enable/origin time. The first target transition starts immediately here. */
  startTimeMs?: number
  /** Minimum delay before choosing the next target. Must be greater than zero. */
  intervalMs?: number
  /** Additional seeded delay sampled from [0, variationMs). */
  variationMs?: number
  /** Duration of each gaze transition. Retargeting rebases from the resolved in-flight pose. */
  transitionDurationMs?: number
  easing?: EasingId
  /** Optional absolute gaze-unit bounds. Omitted axes use the full canvas-safe range. */
  xRange?: IdleGazeRange
  yRange?: IdleGazeRange
}

export type NormalizedIdleGazeDefinition = {
  kind: typeof IDLE_GAZE_KIND
  enabled: boolean
  startTimeMs: number
  intervalMs: number
  variationMs: number
  transitionDurationMs: number
  easing: EasingId
  xRange?: IdleGazeRange
  yRange?: IdleGazeRange
}

export type ScheduledIdleGazeTarget = {
  epochIndex: number
  targetIndex: number
  startTimeMs: number
  target: Point
}

export type ResolvedIdleGaze = {
  active: boolean
  model: FaceModel
  targets: readonly ScheduledIdleGazeTarget[]
}

type IdleGazeConfig = Pick<
  NormalizedIdleGazeDefinition,
  'intervalMs' | 'variationMs' | 'transitionDurationMs' | 'easing' | 'xRange' | 'yRange'
>

type IdleGazeEpoch = IdleGazeConfig & {
  index: number
  startTimeMs: number
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

function parseRange(value: unknown, label: string): IdleGazeRange {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  const min = value.min
  const max = value.max
  if (typeof min !== 'number' || !Number.isFinite(min) || typeof max !== 'number' || !Number.isFinite(max)) {
    throw new TypeError(`${label} min/max must be finite numbers`)
  }
  if (min > max) throw new RangeError(`${label} min must be <= max`)
  return {
    min: Object.is(min, -0) ? 0 : min,
    max: Object.is(max, -0) ? 0 : max,
  }
}

function parseEasing(value: unknown, label: string): EasingId {
  if (typeof value !== 'string' || !isEasingId(value)) {
    throw new RangeError(`${label} must be a supported easing id`)
  }
  return value
}

export function normalizeIdleGazeDefinition(value: unknown): NormalizedIdleGazeDefinition {
  if (!isRecord(value)) throw new TypeError('Idle gaze definition must be an object')
  if (value.kind !== IDLE_GAZE_KIND) {
    throw new RangeError(`Unsupported idle gaze kind: ${String(value.kind)}`)
  }

  const enabled = value.enabled ?? DEFAULT_IDLE_GAZE.enabled
  if (typeof enabled !== 'boolean') throw new TypeError('Idle gaze enabled must be boolean')

  const normalized: NormalizedIdleGazeDefinition = {
    kind: IDLE_GAZE_KIND,
    enabled,
    startTimeMs: value.startTimeMs === undefined
      ? DEFAULT_IDLE_GAZE.startTimeMs
      : nonNegativeFinite(value.startTimeMs, 'Idle gaze startTimeMs'),
    intervalMs: value.intervalMs === undefined
      ? DEFAULT_IDLE_GAZE.intervalMs
      : positiveFinite(value.intervalMs, 'Idle gaze intervalMs'),
    variationMs: value.variationMs === undefined
      ? DEFAULT_IDLE_GAZE.variationMs
      : nonNegativeFinite(value.variationMs, 'Idle gaze variationMs'),
    transitionDurationMs: value.transitionDurationMs === undefined
      ? DEFAULT_IDLE_GAZE.transitionDurationMs
      : nonNegativeFinite(value.transitionDurationMs, 'Idle gaze transitionDurationMs'),
    easing: value.easing === undefined
      ? DEFAULT_IDLE_GAZE.easing
      : parseEasing(value.easing, 'Idle gaze easing'),
  }

  if (value.xRange !== undefined) normalized.xRange = parseRange(value.xRange, 'Idle gaze xRange')
  if (value.yRange !== undefined) normalized.yRange = parseRange(value.yRange, 'Idle gaze yRange')
  return normalized
}

export function isIdleGazeControlAction(action: string): action is IdleGazeControlAction {
  return (IDLE_GAZE_CONTROL_ACTIONS as readonly string[]).includes(action)
}

function configFromDefinition(definition: NormalizedIdleGazeDefinition): IdleGazeConfig {
  return {
    intervalMs: definition.intervalMs,
    variationMs: definition.variationMs,
    transitionDurationMs: definition.transitionDurationMs,
    easing: definition.easing,
    ...(definition.xRange === undefined ? {} : { xRange: { ...definition.xRange } }),
    ...(definition.yRange === undefined ? {} : { yRange: { ...definition.yRange } }),
  }
}

function configFromPayload(payload: JsonObject | undefined, fallback: IdleGazeConfig): IdleGazeConfig {
  if (payload === undefined) return fallback
  const next: IdleGazeConfig = {
    intervalMs: payload.intervalMs === undefined
      ? fallback.intervalMs
      : positiveFinite(payload.intervalMs, 'Idle gaze enable intervalMs'),
    variationMs: payload.variationMs === undefined
      ? fallback.variationMs
      : nonNegativeFinite(payload.variationMs, 'Idle gaze enable variationMs'),
    transitionDurationMs: payload.transitionDurationMs === undefined
      ? fallback.transitionDurationMs
      : nonNegativeFinite(payload.transitionDurationMs, 'Idle gaze enable transitionDurationMs'),
    easing: payload.easing === undefined
      ? fallback.easing
      : parseEasing(payload.easing, 'Idle gaze enable easing'),
  }

  if (payload.xRange !== undefined) next.xRange = parseRange(payload.xRange, 'Idle gaze enable xRange')
  else if (fallback.xRange !== undefined) next.xRange = { ...fallback.xRange }
  if (payload.yRange !== undefined) next.yRange = parseRange(payload.yRange, 'Idle gaze enable yRange')
  else if (fallback.yRange !== undefined) next.yRange = { ...fallback.yRange }
  return next
}

function activeEpochAtTime(
  definition: NormalizedIdleGazeDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
): IdleGazeEpoch | undefined {
  const controls = events
    .filter((event) =>
      event.channel === 'gaze-pose' &&
      event.startTimeMs <= timeMs &&
      isIdleGazeControlAction(event.action),
    )
    .slice()
    .sort(compareRuntimeAnimationEvents)

  const fallback = configFromDefinition(definition)
  let nextEpochIndex = 0
  let active: IdleGazeEpoch | undefined = definition.enabled
    ? { index: nextEpochIndex++, startTimeMs: definition.startTimeMs, ...fallback }
    : undefined

  for (const event of controls) {
    if (event.action === 'idle-gaze-disable') {
      active = undefined
      continue
    }
    active = {
      index: nextEpochIndex++,
      startTimeMs: event.startTimeMs,
      ...configFromPayload(event.payload, fallback),
    }
  }

  if (active === undefined || active.startTimeMs > timeMs) return undefined
  return active
}

function intersectRange(requested: NumericRange | undefined, safe: NumericRange, label: string): NumericRange {
  const min = Math.max(requested?.min ?? safe.min, safe.min)
  const max = Math.min(requested?.max ?? safe.max, safe.max)
  if (min > max) {
    throw new RangeError(`${label} does not intersect the canvas-safe gaze range`)
  }
  return { min, max }
}

function clamp(value: number, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}

/**
 * Curiosity can change the eye height as horizontal gaze increases, which in
 * turn changes safe canvas limits. Iterate target clamping until the target is
 * safe for the gaze-reactive geometry itself, while also staying inside the
 * authored idle range.
 */
function stabilizeTarget(
  sourceModel: FaceModel,
  requestedX: NumericRange | undefined,
  requestedY: NumericRange | undefined,
  initial: Point,
): Point {
  let current = { ...initial }

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const probe = cloneFaceModel(sourceModel)
    probe.gaze = { ...current }
    const limits = gazeLimits(probe)
    const xRange = intersectRange(requestedX, limits.x, 'Idle gaze xRange')
    const yRange = intersectRange(requestedY, limits.y, 'Idle gaze yRange')
    const next = {
      x: clamp(current.x, xRange),
      y: clamp(current.y, yRange),
    }
    const nextProbe = cloneFaceModel(sourceModel)
    nextProbe.gaze = { ...next }
    if (next.x === current.x && next.y === current.y && isGazeCanvasSafe(nextProbe)) {
      return next
    }
    current = next
  }

  const finalProbe = cloneFaceModel(sourceModel)
  finalProbe.gaze = { ...current }
  if (!isGazeCanvasSafe(finalProbe)) {
    throw new RangeError('Idle gaze target could not converge to a canvas-safe position')
  }
  return current
}

function targetForIndex(
  sourceModel: FaceModel,
  epoch: IdleGazeEpoch,
  seed: number,
  targetIndex: number,
): Point {
  const sourceLimits = gazeLimits(sourceModel)
  const xRange = intersectRange(epoch.xRange, sourceLimits.x, 'Idle gaze xRange')
  const yRange = intersectRange(epoch.yRange, sourceLimits.y, 'Idle gaze yRange')
  const x = sampleRandomRange(
    seed,
    `${IDLE_GAZE_RANDOM_STREAM}:epoch-${epoch.index}:x`,
    targetIndex,
    xRange.min,
    xRange.max,
  )
  const y = sampleRandomRange(
    seed,
    `${IDLE_GAZE_RANDOM_STREAM}:epoch-${epoch.index}:y`,
    targetIndex,
    yRange.min,
    yRange.max,
  )
  return stabilizeTarget(sourceModel, epoch.xRange, epoch.yRange, { x, y })
}

function targetTimesThrough(epoch: IdleGazeEpoch, seed: number, timeMs: number): number[] {
  if (timeMs < epoch.startTimeMs) return []
  return [
    epoch.startTimeMs,
    ...scheduledEventTimesThrough({
      stream: `${IDLE_GAZE_RANDOM_STREAM}:epoch-${epoch.index}:timing`,
      startTimeMs: epoch.startTimeMs,
      intervalMs: epoch.intervalMs,
      variationMs: epoch.variationMs,
    }, seed, timeMs),
  ]
}

function transitionToTarget(
  sourceModel: FaceModel,
  epoch: IdleGazeEpoch,
  targetIndex: number,
  startTimeMs: number,
  target: Point,
): FaceTransitionDefinition {
  return {
    ...createFaceTransition(
      `@idle-gaze/${epoch.index}/${targetIndex}`,
      { gaze: target },
      startTimeMs,
      epoch.transitionDurationMs,
      epoch.easing,
    ),
    from: cloneFaceModel(sourceModel),
  }
}

function evaluateActiveEpoch(
  baseModel: FaceModel,
  epoch: IdleGazeEpoch,
  timeMs: number,
  seed: number,
): ResolvedIdleGaze {
  const normalizedSeed = normalizeAnimationSeed(seed)
  const targetTimes = targetTimesThrough(epoch, normalizedSeed, timeMs)
  const targets: ScheduledIdleGazeTarget[] = []
  let transition: FaceTransitionDefinition | undefined

  for (let targetIndex = 0; targetIndex < targetTimes.length; targetIndex += 1) {
    const startTimeMs = targetTimes[targetIndex]
    const sourceModel = transition === undefined
      ? cloneFaceModel(baseModel)
      : sampleFaceTransition(transition, baseModel, startTimeMs)
    const target = targetForIndex(sourceModel, epoch, normalizedSeed, targetIndex)
    transition = transitionToTarget(sourceModel, epoch, targetIndex, startTimeMs, target)
    targets.push({
      epochIndex: epoch.index,
      targetIndex,
      startTimeMs,
      target: { ...target },
    })
  }

  return {
    active: true,
    model: transition === undefined
      ? cloneFaceModel(baseModel)
      : sampleFaceTransition(transition, baseModel, timeMs),
    targets,
  }
}

export function resolveIdleGaze(
  definition: IdleGazeDefinition | NormalizedIdleGazeDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  baseModel: FaceModel,
  timeMs: number,
  seed: number,
): ResolvedIdleGaze {
  const normalized = normalizeIdleGazeDefinition(definition)
  const sampleTimeMs = nonNegativeFinite(timeMs, 'Idle gaze sample time')
  const normalizedSeed = normalizeAnimationSeed(seed)
  const epoch = activeEpochAtTime(normalized, events, sampleTimeMs)
  if (epoch === undefined) {
    return { active: false, model: cloneFaceModel(baseModel), targets: [] }
  }
  return evaluateActiveEpoch(baseModel, epoch, sampleTimeMs, normalizedSeed)
}

export function scheduledIdleGazeTargets(
  definition: IdleGazeDefinition | NormalizedIdleGazeDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  baseModel: FaceModel,
  timeMs: number,
  seed: number,
): ScheduledIdleGazeTarget[] {
  return resolveIdleGaze(definition, events, baseModel, timeMs, seed)
    .targets.map((entry) => ({ ...entry, target: { ...entry.target } }))
}

function definitionFromChannel(value: JsonValue | undefined): NormalizedIdleGazeDefinition {
  if (value === undefined) return normalizeIdleGazeDefinition({ kind: IDLE_GAZE_KIND })
  return normalizeIdleGazeDefinition(value)
}

export const idleGazeChannelResolver: AnimationChannelResolver = ({
  model,
  channelDefinition,
  context,
  events,
}) => {
  const definition = definitionFromChannel(channelDefinition)
  return resolveIdleGaze(definition, events, model, context.timeMs, context.seed).model
}
