import {
  canFitEyesInCanvas,
  clampGaze,
  gazeLimits,
  isGazeCanvasSafe,
  type FaceModel,
  type NumericRange,
} from '../../core/model'
import { expressionPresets } from '../../core/presets'
import {
  ANIMATION_DEFINITION_VERSION,
  EMPTY_TRANSIENT_EFFECT_FRAME,
  PRESET_ANIMATION_DEFAULTS_VERSION,
  behaviorProfileChannelResolvers,
  evaluateAnimationFrame,
  genericStateTransitionChannelResolver,
  initializePresetAnimation,
  resolveTransientEffectFrame,
  sampleAnimationProgram,
  type AnimationChannelResolvers,
  type AnimationDefinition,
  type JsonObject,
  type JsonValue,
  type PresetAnimationDefaults,
  type PresetAnimationDefaultsV1,
  type RuntimeAnimationEvent,
  type TransientEffectFrame,
} from '../../animation'

export type AnimationPreviewOptions = {
  timeMs: number
  runtimeEvents?: readonly RuntimeAnimationEvent[]
  reducedMotion?: boolean
}

export type EditorAnimationPreviewFrame = {
  model: FaceModel
  transientEffects: TransientEffectFrame
}

const editorChannelResolvers: AnimationChannelResolvers = {
  ...behaviorProfileChannelResolvers,
  'state-transition': genericStateTransitionChannelResolver,
}

const ROBOEYES_REFERENCE_SWEAT_FALL_SPEED = 0.025
const EDITOR_SWEAT_FALL_SPEED = 0.008

function mergeDefinitions(
  profileDefinition: AnimationDefinition | undefined,
  authoredDefinition: AnimationDefinition,
  reducedMotion: boolean,
): AnimationDefinition {
  if (reducedMotion) {
    return {
      version: ANIMATION_DEFINITION_VERSION,
      enabled: false,
    }
  }

  const profileChannels = profileDefinition?.enabled ? profileDefinition.channels : undefined
  const authoredChannels = authoredDefinition.enabled ? authoredDefinition.channels : undefined
  const channels = {
    ...(profileChannels ?? {}),
    ...(authoredChannels ?? {}),
  }
  return {
    version: ANIMATION_DEFINITION_VERSION,
    enabled: Boolean(profileDefinition?.enabled || authoredDefinition.enabled),
    ...(Object.keys(channels).length === 0 ? {} : { channels }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function editorTransientEffectDefinition(value: JsonValue | undefined): JsonValue | undefined {
  if (!isRecord(value) || value.kind !== 'transient-effect-layer' || !Array.isArray(value.effects)) {
    return value
  }

  let changed = false
  const effects = value.effects.map((effect) => {
    if (!isRecord(effect) || effect.kind !== 'sweat') return effect as JsonValue
    const fallSpeed = effect.fallSpeed
    if (fallSpeed !== undefined && fallSpeed !== ROBOEYES_REFERENCE_SWEAT_FALL_SPEED) {
      return effect as JsonValue
    }
    changed = true
    return {
      ...effect,
      fallSpeed: EDITOR_SWEAT_FALL_SPEED,
    } as JsonValue
  })

  return changed
    ? { ...value, effects } as JsonValue
    : value
}

function fitRequestedRange(
  value: unknown,
  safe: NumericRange,
  current: number,
): { min: number; max: number } | undefined {
  if (!isRecord(value) ||
      typeof value.min !== 'number' || !Number.isFinite(value.min) ||
      typeof value.max !== 'number' || !Number.isFinite(value.max)) {
    return undefined
  }

  const min = Math.max(value.min, safe.min)
  const max = Math.min(value.max, safe.max)
  if (min <= max) return { min, max }

  // The authored/profile wander window can become completely unreachable when
  // the eye pair is moved near a canvas edge. Keep the behavior channel alive by
  // temporarily pinning this axis to the current safe gaze instead of allowing
  // idle-gaze to throw. This is preview-only and never rewrites persisted data.
  const pinned = Math.min(safe.max, Math.max(safe.min, current))
  return { min: pinned, max: pinned }
}

function fitIdleGazeToPreviewModel(
  definition: AnimationDefinition,
  model: FaceModel,
): AnimationDefinition {
  const channels = definition.enabled ? definition.channels : undefined
  const gazeChannel = channels?.['gaze-pose']
  if (!isRecord(gazeChannel) || gazeChannel.kind !== 'idle-gaze') return definition

  const limits = gazeLimits(model)
  const xRange = fitRequestedRange(gazeChannel.xRange, limits.x, model.gaze.x)
  const yRange = fitRequestedRange(gazeChannel.yRange, limits.y, model.gaze.y)
  const nextGazeChannel: Record<string, JsonValue> = {
    ...(gazeChannel as Record<string, JsonValue>),
    ...(xRange === undefined ? {} : { xRange }),
    ...(yRange === undefined ? {} : { yRange }),
  }

  return {
    ...definition,
    channels: {
      ...channels,
      'gaze-pose': nextGazeChannel,
    },
  }
}

function previewBaseModel(
  baseModel: FaceModel,
  recommendedExpressionPresetId: string | undefined,
): FaceModel {
  const result = structuredClone(baseModel)
  if (recommendedExpressionPresetId !== undefined) {
    const recommended = expressionPresets.find((preset) => preset.id === recommendedExpressionPresetId)
    if (recommended !== undefined) result.expression = structuredClone(recommended.expression)
  }

  if (!canFitEyesInCanvas(result)) return result
  const clamped = clampGaze(result)
  return isGazeCanvasSafe(clamped) ? clamped : result
}

function canAnimatePreviewBase(model: FaceModel): boolean {
  return canFitEyesInCanvas(model) && isGazeCanvasSafe(model)
}

/**
 * Convert legacy `{}` defaults into an editable versioned envelope only when the
 * editor actually changes animation authoring data.
 */
export function editableAnimationDefaults(
  input: PresetAnimationDefaults,
): PresetAnimationDefaultsV1 {
  const initialized = initializePresetAnimation(input)
  return {
    version: PRESET_ANIMATION_DEFAULTS_VERSION,
    seed: initialized.seed,
    definition: structuredClone(initialized.definition),
    ...(initialized.behaviorProfile === undefined
      ? {}
      : { behaviorProfile: structuredClone(initialized.behaviorProfile) }),
    ...(initialized.program === undefined
      ? {}
      : { program: structuredClone(initialized.program) }),
  }
}

export function evaluateEditorAnimationPreviewFrame(
  baseModel: FaceModel,
  defaults: PresetAnimationDefaults,
  options: AnimationPreviewOptions,
): EditorAnimationPreviewFrame {
  const initialized = initializePresetAnimation(defaults)
  const manualEvents = options.runtimeEvents ?? []

  const previewBase = previewBaseModel(
    baseModel,
    initialized.behaviorProfile?.recommendedExpressionPresetId,
  )

  // Static editing deliberately permits transient/off-canvas geometry while the
  // user is manipulating controls. The core animation transition contract is
  // stricter. Never let that temporary mismatch tear down the React render tree;
  // keep showing the authored/static preview until the model is animatable again.
  if (!canAnimatePreviewBase(previewBase)) {
    return { model: previewBase, transientEffects: EMPTY_TRANSIENT_EFFECT_FRAME }
  }

  try {
    let stateModel = previewBase
    let programEvents: readonly RuntimeAnimationEvent[] = []
    if (initialized.program !== undefined) {
      const sample = sampleAnimationProgram(initialized.program, previewBase, options.timeMs)
      stateModel = sample.model
      programEvents = sample.runtimeEvents
    }

    const definition = fitIdleGazeToPreviewModel(
      mergeDefinitions(
        initialized.behaviorProfile?.animation,
        initialized.definition,
        options.reducedMotion ?? false,
      ),
      stateModel,
    )
    const allRuntimeEvents = [...programEvents, ...manualEvents]
    const resolved = evaluateAnimationFrame({
      baseModel: stateModel,
      definition,
      context: { timeMs: options.timeMs, seed: initialized.seed },
      runtimeEvents: allRuntimeEvents,
      channelResolvers: editorChannelResolvers,
    })
    const transientEffects = resolveTransientEffectFrame(
      editorTransientEffectDefinition(
        definition.enabled ? definition.channels?.['transient-effect'] : undefined,
      ),
      allRuntimeEvents,
      resolved.model,
      options.timeMs,
      initialized.seed,
    )

    return { model: resolved.model, transientEffects }
  } catch (error) {
    // An otherwise valid authored program/profile can become temporarily
    // incompatible with a newly edited base geometry. Preview is non-authoring
    // state, so falling back to the current static model is safer than crashing
    // the editor. Persisted data and the core runtime remain strict.
    if (error instanceof RangeError || error instanceof TypeError) {
      return { model: previewBase, transientEffects: EMPTY_TRANSIENT_EFFECT_FRAME }
    }
    throw error
  }
}

export function evaluateEditorAnimationFrame(
  baseModel: FaceModel,
  defaults: PresetAnimationDefaults,
  options: AnimationPreviewOptions,
): FaceModel {
  return evaluateEditorAnimationPreviewFrame(baseModel, defaults, options).model
}

export function nextRuntimeEvent(
  action: string,
  channel: RuntimeAnimationEvent['channel'],
  timeMs: number,
  order: number,
  payload?: JsonObject,
): RuntimeAnimationEvent {
  return {
    id: `@editor/${order}/${action}`,
    channel,
    action,
    startTimeMs: timeMs,
    order,
    priority: 100,
    ...(payload === undefined ? {} : { payload: structuredClone(payload) }),
  }
}
