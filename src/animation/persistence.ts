import {
  normalizeBehaviorProfile,
  normalizeContinuousMotionDefinition,
  type BehaviorProfile,
} from './behaviorProfiles'
import { normalizeEyeOpennessDefinition } from './eyeOpenness'
import { normalizeIdleGazeDefinition } from './idleGaze'
import { normalizeAnimationProgram, type AnimationProgram } from './program'
import { normalizeAnimationSeed } from './random'
import {
  ANIMATION_DEFINITION_VERSION,
  EMPTY_ANIMATION_DEFINITION,
  normalizeAnimationDefinition,
  type AnimationDefinition,
  type JsonValue,
} from './runtime'
import { normalizeFaceTransitionDefinition } from './transition'

export const PRESET_ANIMATION_DEFAULTS_VERSION = 1 as const

/**
 * Empty object is retained as the Phase 1/2 compatibility representation.
 * Non-empty authoring data uses the versioned envelope below.
 */
export type LegacyEmptyAnimationDefaults = Record<string, never>

export type PresetAnimationDefaultsV1 = {
  version: typeof PRESET_ANIMATION_DEFAULTS_VERSION
  /** Stable authored/default seed. Runtime PRNG cursor is deliberately absent. */
  seed?: number
  /** Generic ambient/channel definition authored directly on the face preset. */
  definition?: AnimationDefinition
  /** Optional reusable temporal behavior profile from #104. */
  behaviorProfile?: BehaviorProfile
  /** Optional reusable ordered state/action program from #112. */
  program?: AnimationProgram
}

export type PresetAnimationDefaults = LegacyEmptyAnimationDefaults | PresetAnimationDefaultsV1

export type InitializedPresetAnimation = {
  seed: number
  definition: AnimationDefinition
  behaviorProfile?: BehaviorProfile
  program?: AnimationProgram
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new RangeError(`${label} contains unsupported field: ${key}`)
  }
}

function isEmptyRecord(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0
}

function normalizeAnimationChannelDefinition(channel: string, value: JsonValue): JsonValue {
  switch (channel) {
    case 'state-transition':
      return normalizeFaceTransitionDefinition(value) as unknown as JsonValue
    case 'gaze-pose':
      return normalizeIdleGazeDefinition(value) as unknown as JsonValue
    case 'eye-openness':
      return normalizeEyeOpennessDefinition(value) as unknown as JsonValue
    case 'motion-offset':
      return normalizeContinuousMotionDefinition(value) as unknown as JsonValue
    case 'transient-effect':
      throw new RangeError('Persisted transient-effect data is not supported until its schema is defined')
    default:
      throw new RangeError(`Unsupported persisted animation channel: ${channel}`)
  }
}

/** Validate both the generic envelope and each currently supported authored channel schema. */
export function normalizePersistedAnimationDefinition(value: unknown): AnimationDefinition {
  if (!isRecord(value)) throw new TypeError('Persisted animation definition must be an object')
  assertAllowedKeys(value, ['version', 'enabled', 'channels'], 'Persisted animation definition')
  const normalized = normalizeAnimationDefinition(value as AnimationDefinition)
  if (normalized.channels === undefined) return normalized

  const channels: AnimationDefinition['channels'] = {}
  for (const [channel, channelDefinition] of Object.entries(normalized.channels)) {
    if (channelDefinition === undefined) continue
    channels[channel as keyof typeof channels] = normalizeAnimationChannelDefinition(channel, channelDefinition)
  }
  return { ...normalized, channels }
}

function normalizePersistedBehaviorProfile(value: unknown): BehaviorProfile {
  if (!isRecord(value)) throw new TypeError('Persisted behavior profile must be an object')
  assertAllowedKeys(
    value,
    ['id', 'name', 'version', 'recommendedExpressionPresetId', 'animation'],
    'Persisted behavior profile',
  )
  const normalized = normalizeBehaviorProfile(value)
  return {
    ...normalized,
    animation: normalizePersistedAnimationDefinition(normalized.animation),
  }
}

function assertProgramShapeStrict(value: unknown): void {
  if (!isRecord(value)) throw new TypeError('Persisted animation program must be an object')
  assertAllowedKeys(value, ['version', 'id', 'name', 'playbackMode', 'steps'], 'Persisted animation program')
  if (!Array.isArray(value.steps)) return
  for (let stepIndex = 0; stepIndex < value.steps.length; stepIndex += 1) {
    const step = value.steps[stepIndex]
    if (!isRecord(step)) continue
    assertAllowedKeys(
      step,
      ['id', 'target', 'transitionDurationMs', 'easing', 'holdDurationMs', 'actions'],
      `Persisted animation program step ${stepIndex}`,
    )
    if (!Array.isArray(step.actions)) continue
    for (let actionIndex = 0; actionIndex < step.actions.length; actionIndex += 1) {
      const action = step.actions[actionIndex]
      if (!isRecord(action)) continue
      assertAllowedKeys(
        action,
        ['id', 'channel', 'action', 'offsetMs', 'priority', 'payload'],
        `Persisted animation program step ${stepIndex} action ${actionIndex}`,
      )
    }
  }
}

function normalizePersistedProgram(value: unknown): AnimationProgram {
  assertProgramShapeStrict(value)
  return normalizeAnimationProgram(value)
}

/**
 * Normalize preset authoring data. Runtime-only fields are rejected because they
 * are not members of the allow-list rather than silently being persisted.
 */
export function normalizePresetAnimationDefaults(value: unknown): PresetAnimationDefaults {
  if (!isRecord(value)) throw new TypeError('Preset animationDefaults must be an object')
  if (isEmptyRecord(value)) return {}

  assertAllowedKeys(
    value,
    ['version', 'seed', 'definition', 'behaviorProfile', 'program'],
    'Preset animationDefaults',
  )
  if (value.version !== PRESET_ANIMATION_DEFAULTS_VERSION) {
    throw new RangeError(`Unsupported preset animationDefaults version: ${String(value.version)}`)
  }

  const result: PresetAnimationDefaultsV1 = { version: PRESET_ANIMATION_DEFAULTS_VERSION }
  if (value.seed !== undefined) result.seed = normalizeAnimationSeed(value.seed as number)
  if (value.definition !== undefined) result.definition = normalizePersistedAnimationDefinition(value.definition)
  if (value.behaviorProfile !== undefined) result.behaviorProfile = normalizePersistedBehaviorProfile(value.behaviorProfile)
  if (value.program !== undefined) result.program = normalizePersistedProgram(value.program)
  return result
}

export function isPresetAnimationDefaults(value: unknown): value is PresetAnimationDefaults {
  try {
    normalizePresetAnimationDefaults(value)
    return true
  } catch {
    return false
  }
}

/**
 * Create deterministic runtime inputs from persisted authoring defaults. This
 * function intentionally creates no elapsed position, one-shot history, PRNG
 * cursor, pause state, or scheduler progress.
 */
export function initializePresetAnimation(
  value: PresetAnimationDefaults,
): InitializedPresetAnimation {
  const normalized = normalizePresetAnimationDefaults(value)
  if (!('version' in normalized)) {
    return {
      seed: 0,
      definition: { ...EMPTY_ANIMATION_DEFINITION },
    }
  }
  return {
    seed: normalized.seed ?? 0,
    definition: normalized.definition ?? {
      version: ANIMATION_DEFINITION_VERSION,
      enabled: false,
    },
    ...(normalized.behaviorProfile === undefined
      ? {}
      : { behaviorProfile: structuredClone(normalized.behaviorProfile) }),
    ...(normalized.program === undefined ? {} : { program: structuredClone(normalized.program) }),
  }
}
