export {
  advancePlaybackClock,
  createPlaybackClock,
  pausePlaybackClock,
  playPlaybackClock,
  seekPlaybackClock,
  setPlaybackRate,
  stopPlaybackClock,
} from './clock'
export type { PlaybackClockState, PlaybackClockStatus } from './clock'

export {
  applyEasing,
  EASING_IDS,
  isEasingId,
} from './easing'
export type { EasingId } from './easing'

export {
  deriveRandomStreamSeed,
  MAX_ANIMATION_SEED,
  normalizeAnimationSeed,
  sampleRandomRange,
  sampleRandomUint32,
  sampleRandomUnit,
} from './random'

export {
  scheduledDelayMs,
  scheduledEventTimeMs,
  scheduledEventTimesThrough,
} from './scheduler'
export type { DeterministicIntervalSchedule } from './scheduler'

export {
  ANIMATION_COMPOSITION_ORDER,
  ANIMATION_DEFINITION_VERSION,
  ANIMATION_RUNTIME_CHANNELS,
  cloneFaceModel,
  compareRuntimeAnimationEvents,
  createAnimationFrameContext,
  EMPTY_ANIMATION_DEFINITION,
  evaluateAnimationFrame,
  isJsonValue,
  normalizeAnimationDefinition,
  normalizeRuntimeAnimationEvents,
  resolveDominantRuntimeEvent,
  runtimeEventsAtOrBefore,
} from './runtime'
export type {
  AnimationChannelResolver,
  AnimationChannelResolverInput,
  AnimationChannelResolvers,
  AnimationCompositionChannel,
  AnimationDefinition,
  AnimationFrameContext,
  AnimationRuntimeChannel,
  EvaluateAnimationFrameInput,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  NormalizedRuntimeAnimationEvent,
  ResolvedAnimationFrame,
  RuntimeAnimationEvent,
} from './runtime'

export {
  createFaceTransition,
  eyeSpacing,
  FACE_TRANSITION_KIND,
  faceTransitionProgress,
  GAZE_DIRECTIONS,
  gazeTargetForDirection,
  gazeTargetForRoboEyesPosition,
  interpolateExpressionModel,
  interpolateFaceModel,
  interpolateNumber,
  normalizeFaceStateTarget,
  normalizeFaceTransitionDefinition,
  normalizedGazeTarget,
  retargetFaceTransition,
  ROBOEYES_GAZE_POSITIONS,
  sampleFaceTransition,
  stateTransitionChannelResolver,
  withEyeSpacing,
} from './transition'
export type {
  EyeStateTarget,
  FaceStateTarget,
  FaceTransitionDefinition,
  GazeDirection,
  RetargetFaceTransitionOptions,
  RoboEyesGazePosition,
} from './transition'
