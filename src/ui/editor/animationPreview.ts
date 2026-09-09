import { canFitEyesInCanvas, clampGaze, isGazeCanvasSafe, type FaceModel } from '../../core/model'
import { expressionPresets } from '../../core/presets'
import {
  ANIMATION_DEFINITION_VERSION,
  PRESET_ANIMATION_DEFAULTS_VERSION,
  behaviorProfileChannelResolvers,
  evaluateAnimationFrame,
  initializePresetAnimation,
  sampleAnimationProgram,
  stateTransitionChannelResolver,
  type AnimationChannelResolvers,
  type AnimationDefinition,
  type JsonObject,
  type PresetAnimationDefaults,
  type PresetAnimationDefaultsV1,
  type RuntimeAnimationEvent,
} from '../../animation'

export type AnimationPreviewOptions = {
  timeMs: number
  runtimeEvents?: readonly RuntimeAnimationEvent[]
  reducedMotion?: boolean
}

const editorChannelResolvers: AnimationChannelResolvers = {
  ...behaviorProfileChannelResolvers,
  'state-transition': stateTransitionChannelResolver,
}

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

export function evaluateEditorAnimationFrame(
  baseModel: FaceModel,
  defaults: PresetAnimationDefaults,
  options: AnimationPreviewOptions,
): FaceModel {
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
  if (!canAnimatePreviewBase(previewBase)) return previewBase

  try {
    let stateModel = previewBase
    let programEvents: readonly RuntimeAnimationEvent[] = []
    if (initialized.program !== undefined) {
      const sample = sampleAnimationProgram(initialized.program, previewBase, options.timeMs)
      stateModel = sample.model
      programEvents = sample.runtimeEvents
    }

    const definition = mergeDefinitions(
      initialized.behaviorProfile?.animation,
      initialized.definition,
      options.reducedMotion ?? false,
    )

    return evaluateAnimationFrame({
      baseModel: stateModel,
      definition,
      context: { timeMs: options.timeMs, seed: initialized.seed },
      runtimeEvents: [...programEvents, ...manualEvents],
      channelResolvers: editorChannelResolvers,
    }).model
  } catch (error) {
    // An otherwise valid authored program/profile can become temporarily
    // incompatible with a newly edited base geometry. Preview is non-authoring
    // state, so falling back to the current static model is safer than crashing
    // the editor. Persisted data and the core runtime remain strict.
    if (error instanceof RangeError || error instanceof TypeError) return previewBase
    throw error
  }
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