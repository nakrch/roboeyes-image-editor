import type { FaceModel } from '../core/model'
import {
  applyMotionOffset,
  isMotionOffsetAction,
  motionOffsetChannelResolver,
  normalizeMotionPrimitiveDefinition,
  resolveMotionOffset,
  sampleMotionPrimitive,
  type MotionAxis,
  type MotionWaveform,
} from './motionOffset'
import { eyeOpennessChannelResolver } from './eyeOpenness'
import { idleGazeChannelResolver } from './idleGaze'
import {
  evaluateAnimationFrame,
  normalizeAnimationDefinition,
  type AnimationChannelResolver,
  type AnimationChannelResolvers,
  type AnimationDefinition,
  type AnimationFrameContext,
  type JsonValue,
  type RuntimeAnimationEvent,
} from './runtime'

export const BEHAVIOR_PROFILE_VERSION = 1 as const
export const CONTINUOUS_MOTION_KIND = 'continuous-motion' as const

export type ContinuousMotionDefinition = {
  kind: typeof CONTINUOUS_MOTION_KIND
  startTimeMs?: number
  axis: MotionAxis
  amplitude: number
  periodMs: number
  phase?: number
  waveform?: MotionWaveform
}

export type BehaviorProfile = {
  id: string
  name: string
  version: typeof BEHAVIOR_PROFILE_VERSION
  /** Static expression is deliberately only a recommendation/reference. */
  recommendedExpressionPresetId?: string
  animation: AnimationDefinition
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

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`)
  return value
}

export function normalizeContinuousMotionDefinition(value: unknown): ContinuousMotionDefinition {
  if (!isRecord(value) || value.kind !== CONTINUOUS_MOTION_KIND) {
    throw new RangeError(`Unsupported continuous motion kind: ${String(isRecord(value) ? value.kind : value)}`)
  }
  const primitive = normalizeMotionPrimitiveDefinition({
    axis: value.axis,
    amplitude: value.amplitude,
    durationMs: 1,
    periodMs: value.periodMs,
    phase: value.phase,
    waveform: value.waveform,
  })
  return {
    kind: CONTINUOUS_MOTION_KIND,
    startTimeMs: value.startTimeMs === undefined ? 0 : nonNegativeFinite(value.startTimeMs, 'Continuous motion startTimeMs'),
    axis: primitive.axis,
    amplitude: primitive.amplitude,
    periodMs: primitive.periodMs,
    phase: primitive.phase,
    waveform: primitive.waveform,
  }
}

function continuousMotionFromChannel(value: JsonValue | undefined): ContinuousMotionDefinition | undefined {
  if (!isRecord(value) || value.kind !== CONTINUOUS_MOTION_KIND) return undefined
  return normalizeContinuousMotionDefinition(value)
}

/**
 * Continuous authored profile motion uses the same #103 waveform sampler. Runtime
 * motion events temporarily override it; `motion-stop` suppresses the authored
 * baseline until another runtime motion trigger occurs.
 */
export const behaviorProfileMotionOffsetResolver: AnimationChannelResolver = (input) => {
  const continuous = continuousMotionFromChannel(input.channelDefinition)
  if (continuous === undefined) return motionOffsetChannelResolver(input)

  const latest = input.events.at(-1)
  if (latest !== undefined) {
    if (!isMotionOffsetAction(latest.action)) throw new RangeError(`Unsupported motion-offset action: ${latest.action}`)
    if (latest.action === 'motion-stop') return input.model
    const runtime = resolveMotionOffset(input.events, input.context.timeMs, input.context.seed)
    if (runtime.active) return applyMotionOffset(input.model, runtime)
  }

  const start = continuous.startTimeMs ?? 0
  if (input.context.timeMs < start) return input.model
  const sampled = sampleMotionPrimitive({
    axis: continuous.axis,
    amplitude: continuous.amplitude,
    durationMs: Math.max(1, input.context.timeMs - start + 1),
    periodMs: continuous.periodMs,
    phase: continuous.phase,
    waveform: continuous.waveform,
  }, start, input.context.timeMs, input.context.seed, 'behavior-profile:continuous-motion')
  return applyMotionOffset(input.model, sampled)
}

export const behaviorProfileChannelResolvers: AnimationChannelResolvers = {
  'gaze-pose': idleGazeChannelResolver,
  'eye-openness': eyeOpennessChannelResolver,
  'motion-offset': behaviorProfileMotionOffsetResolver,
}

export function normalizeBehaviorProfile(value: unknown): BehaviorProfile {
  if (!isRecord(value)) throw new TypeError('Behavior profile must be an object')
  if (value.version !== BEHAVIOR_PROFILE_VERSION) throw new RangeError(`Unsupported behavior profile version: ${String(value.version)}`)
  const recommended = value.recommendedExpressionPresetId
  if (recommended !== undefined && typeof recommended !== 'string') {
    throw new TypeError('Behavior profile recommendedExpressionPresetId must be a string')
  }
  return {
    id: nonEmptyString(value.id, 'Behavior profile id'),
    name: nonEmptyString(value.name, 'Behavior profile name'),
    version: BEHAVIOR_PROFILE_VERSION,
    ...(recommended === undefined ? {} : { recommendedExpressionPresetId: recommended }),
    animation: normalizeAnimationDefinition(value.animation as AnimationDefinition),
  }
}

function defineProfile(profile: BehaviorProfile): Readonly<BehaviorProfile> {
  return Object.freeze(normalizeBehaviorProfile(profile))
}

export function evaluateBehaviorProfileFrame(
  profile: BehaviorProfile,
  baseModel: FaceModel,
  context: AnimationFrameContext,
  runtimeEvents: readonly RuntimeAnimationEvent[] = [],
): FaceModel {
  return evaluateAnimationFrame({
    baseModel,
    definition: profile.animation,
    context,
    runtimeEvents,
    channelResolvers: behaviorProfileChannelResolvers,
  }).model
}

const autoBlink = (intervalMs: number, variationMs: number) => ({
  kind: 'eye-openness',
  autoBlink: { enabled: true, intervalMs, variationMs },
})

const idle = (
  intervalMs: number,
  variationMs: number,
  transitionDurationMs: number,
  xRange: { min: number; max: number },
  yRange: { min: number; max: number },
) => ({
  kind: 'idle-gaze',
  enabled: true,
  intervalMs,
  variationMs,
  transitionDurationMs,
  easing: 'ease-in-out',
  xRange,
  yRange,
})

const continuous = (
  axis: MotionAxis,
  amplitude: number,
  periodMs: number,
  waveform: MotionWaveform = 'square',
) => ({
  kind: CONTINUOUS_MOTION_KIND,
  axis,
  amplitude,
  periodMs,
  waveform,
  phase: 0,
})

export const defaultBehaviorProfile = defineProfile({
  id: 'behavior:default',
  name: 'Default / Idle',
  version: 1,
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': autoBlink(2_500, 1_500),
      'gaze-pose': idle(1_800, 1_200, 500, { min: -24, max: 24 }, { min: -10, max: 10 }),
    },
  },
})

export const frozenBehaviorProfile = defineProfile({
  id: 'behavior:frozen',
  name: 'Frozen-like',
  version: 1,
  recommendedExpressionPresetId: 'expression:neutral',
  animation: {
    version: 1,
    enabled: true,
    channels: { 'motion-offset': continuous('x', 2, 60) },
  },
})

export const scaryBehaviorProfile = defineProfile({
  id: 'behavior:scary',
  name: 'Scary-like',
  version: 1,
  recommendedExpressionPresetId: 'expression:tired',
  animation: {
    version: 1,
    enabled: true,
    channels: { 'motion-offset': continuous('y', 2, 60) },
  },
})

export const curiousBehaviorProfile = defineProfile({
  id: 'behavior:curious',
  name: 'Curious',
  version: 1,
  recommendedExpressionPresetId: 'expression:curious',
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': autoBlink(1_600, 800),
      'gaze-pose': idle(700, 500, 220, { min: -30, max: 30 }, { min: -12, max: 12 }),
    },
  },
})

export const happyBehaviorProfile = defineProfile({
  id: 'behavior:happy',
  name: 'Happy',
  version: 1,
  recommendedExpressionPresetId: 'expression:happy',
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': autoBlink(1_800, 800),
      'gaze-pose': idle(1_400, 700, 420, { min: -18, max: 18 }, { min: -7, max: 7 }),
      'motion-offset': continuous('y', 2, 700, 'sine'),
    },
  },
})

export const angryBehaviorProfile = defineProfile({
  id: 'behavior:angry',
  name: 'Angry',
  version: 1,
  recommendedExpressionPresetId: 'expression:angry',
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'gaze-pose': idle(10_000, 0, 180, { min: 0, max: 0 }, { min: 0, max: 0 }),
      'motion-offset': continuous('x', 2, 70),
    },
  },
})

export const sleepBehaviorProfile = defineProfile({
  id: 'behavior:sleep',
  name: 'Closed / Sleep',
  version: 1,
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': { kind: 'eye-openness', state: 'sleep' },
    },
  },
})

export const confusedBehaviorProfile = defineProfile({
  id: 'behavior:confused',
  name: 'Confused',
  version: 1,
  recommendedExpressionPresetId: 'expression:neutral',
  animation: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': autoBlink(1_000, 400),
      'gaze-pose': idle(450, 250, 160, { min: -28, max: 28 }, { min: -10, max: 10 }),
      'motion-offset': continuous('x', 4, 55, 'jitter'),
    },
  },
})

export const builtInBehaviorProfiles: readonly Readonly<BehaviorProfile>[] = [
  defaultBehaviorProfile,
  frozenBehaviorProfile,
  scaryBehaviorProfile,
  curiousBehaviorProfile,
  happyBehaviorProfile,
  angryBehaviorProfile,
  sleepBehaviorProfile,
  confusedBehaviorProfile,
]

export function findBehaviorProfile(id: string): Readonly<BehaviorProfile> | undefined {
  return builtInBehaviorProfiles.find((profile) => profile.id === id)
}
