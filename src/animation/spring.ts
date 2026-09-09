import {
  areEyeLidAperturesValid,
  canFitEyesInCanvas,
  clampGaze,
  isGazeCanvasSafe,
  resolveEyeExpression,
  type ExpressionModel,
  type EyeExpression,
  type EyeGeometry,
  type FaceModel,
  type Point,
} from '../core/model'
import { cloneFaceModel, type AnimationChannelResolver } from './runtime'
import {
  FACE_TRANSITION_KIND,
  normalizeFaceStateTarget,
  resolveFaceStateTarget,
  interpolateFaceModel,
  sampleFaceTransition,
  type FaceStateTarget,
  type FaceTransitionDefinition,
} from './transition'

export const SPRING_FACE_TRANSITION_KIND = 'spring-face-model-transition' as const

export type SpringParameters = {
  stiffness: number
  damping: number
  mass: number
}

export const SPRING_PRESET_IDS = ['gentle', 'snappy', 'bouncy'] as const
export type SpringPresetId = typeof SPRING_PRESET_IDS[number]

export const SPRING_PRESETS: Readonly<Record<SpringPresetId, SpringParameters>> = {
  gentle: { stiffness: 120, damping: 22, mass: 1 },
  snappy: { stiffness: 280, damping: 28, mass: 1 },
  bouncy: { stiffness: 180, damping: 12, mass: 1 },
}

export type SpringFaceTransitionDefinition = {
  kind: typeof SPRING_FACE_TRANSITION_KIND
  id: string
  startTimeMs: number
  durationMs: number
  spring: SpringParameters
  target: FaceStateTarget
  from?: FaceModel
}

export type GenericFaceTransitionDefinition = FaceTransitionDefinition | SpringFaceTransitionDefinition

export type RetargetGenericTransitionOptions = {
  id?: string
  durationMs?: number
  spring?: SpringParameters
}

const SPRING_EXPRESSION_KEYS: readonly (keyof Required<EyeExpression>)[] = [
  'upperLid',
  'upperLidInner',
  'upperLidOuter',
  'lowerLid',
  'lowerLidCurvature',
  'tilt',
  'heightScale',
  'gazeHeightExpansion',
  'gazeHeightThreshold',
]

const SPRING_EXPRESSION_DEFAULTS: Required<EyeExpression> = {
  upperLid: 0,
  upperLidInner: 0,
  upperLidOuter: 0,
  lowerLid: 0,
  lowerLidCurvature: 0,
  tilt: 0,
  heightScale: 1,
  gazeHeightExpansion: 0,
  gazeHeightThreshold: 0.15,
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function nonNegative(value: unknown, label: string): number {
  const result = finite(value, label)
  if (result < 0) throw new RangeError(`${label} must be non-negative`)
  return result
}

function positive(value: unknown, label: string): number {
  const result = finite(value, label)
  if (result <= 0) throw new RangeError(`${label} must be greater than zero`)
  return result
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function interpolatePointUnbounded(from: Point, to: Point, progress: number): Point {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
  }
}

function interpolateGeometryUnbounded(
  from: EyeGeometry,
  to: EyeGeometry,
  progress: number,
): EyeGeometry {
  return {
    position: interpolatePointUnbounded(from.position, to.position, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    cornerRadius: lerp(from.cornerRadius, to.cornerRadius, progress),
    rotation: lerp(from.rotation, to.rotation, progress),
  }
}

function sharedExpressionValue(
  expression: ExpressionModel,
  key: keyof Required<EyeExpression>,
): number {
  return expression[key] ?? SPRING_EXPRESSION_DEFAULTS[key]
}

function interpolateResolvedExpressionUnbounded(
  from: Required<EyeExpression>,
  to: Required<EyeExpression>,
  progress: number,
): Required<EyeExpression> {
  const result = {} as Required<EyeExpression>
  for (const key of SPRING_EXPRESSION_KEYS) {
    result[key] = lerp(from[key], to[key], progress)
  }
  return result
}

function interpolateExpressionUnbounded(
  from: ExpressionModel,
  to: ExpressionModel,
  progress: number,
): ExpressionModel {
  const shared = {} as Required<EyeExpression>
  for (const key of SPRING_EXPRESSION_KEYS) {
    shared[key] = lerp(sharedExpressionValue(from, key), sharedExpressionValue(to, key), progress)
  }
  return {
    ...shared,
    leftEye: interpolateResolvedExpressionUnbounded(
      resolveEyeExpression(from, 'left'),
      resolveEyeExpression(to, 'left'),
      progress,
    ),
    rightEye: interpolateResolvedExpressionUnbounded(
      resolveEyeExpression(from, 'right'),
      resolveEyeExpression(to, 'right'),
      progress,
    ),
  }
}

function clampSpringGaze(model: FaceModel): FaceModel | undefined {
  if (!canFitEyesInCanvas(model)) return undefined
  let current = cloneFaceModel(model)
  for (let index = 0; index < 8; index += 1) {
    const next = clampGaze(current)
    if (next.gaze.x === current.gaze.x && next.gaze.y === current.gaze.y) break
    current = next
  }
  if (isGazeCanvasSafe(current)) return current
  const centered = { ...current, gaze: { x: 0, y: 0 } }
  return isGazeCanvasSafe(centered) ? centered : undefined
}

function sampleUnboundedSpringModel(
  from: FaceModel,
  to: FaceModel,
  progress: number,
): FaceModel | undefined {
  const result: FaceModel = {
    canvas: { ...from.canvas },
    leftEye: { geometry: interpolateGeometryUnbounded(from.leftEye.geometry, to.leftEye.geometry, progress) },
    rightEye: { geometry: interpolateGeometryUnbounded(from.rightEye.geometry, to.rightEye.geometry, progress) },
    gaze: interpolatePointUnbounded(from.gaze, to.gaze, progress),
    expression: interpolateExpressionUnbounded(from.expression, to.expression, progress),
    colors: { ...from.colors },
    ...(from.eyeVisibility === undefined ? {} : { eyeVisibility: { ...from.eyeVisibility } }),
  }

  for (const geometry of [result.leftEye.geometry, result.rightEye.geometry]) {
    if (geometry.width < 0 || geometry.height < 0 || geometry.cornerRadius < 0) return undefined
  }
  if (!areEyeLidAperturesValid(result.expression)) return undefined
  return clampSpringGaze(result)
}

/**
 * Interpolate with physical Spring progress, including overshoot, then enforce
 * FaceModel safety at the model boundary. Gaze is clamped directly. If an
 * overshoot would make geometry or eyelids invalid, deterministically bisect
 * back toward the nearest valid endpoint rather than flattening all Spring
 * progress to 0..1.
 */
export function interpolateSpringFaceModel(
  fromModel: FaceModel,
  toModel: FaceModel,
  progressInput: number,
): FaceModel {
  const progress = finite(progressInput, 'Spring face interpolation progress')
  const from = resolveFaceStateTarget(fromModel, {})
  const to = resolveFaceStateTarget(toModel, {})
  if (progress >= 0 && progress <= 1) return interpolateFaceModel(from, to, progress)

  const direct = sampleUnboundedSpringModel(from, to, progress)
  if (direct !== undefined) return direct

  const endpointProgress = progress > 1 ? 1 : 0
  let safeProgress = endpointProgress
  let unsafeProgress = progress
  let safest = interpolateFaceModel(from, to, endpointProgress)

  for (let index = 0; index < 24; index += 1) {
    const candidateProgress = (safeProgress + unsafeProgress) / 2
    const candidate = sampleUnboundedSpringModel(from, to, candidateProgress)
    if (candidate === undefined) {
      unsafeProgress = candidateProgress
    } else {
      safeProgress = candidateProgress
      safest = candidate
    }
  }
  return safest
}

export function normalizeSpringParameters(value: unknown): SpringParameters {
  if (!isRecord(value)) throw new TypeError('Spring parameters must be an object')
  return {
    stiffness: positive(value.stiffness, 'Spring stiffness'),
    damping: nonNegative(value.damping, 'Spring damping'),
    mass: positive(value.mass, 'Spring mass'),
  }
}

export function springPreset(id: SpringPresetId): SpringParameters {
  return { ...SPRING_PRESETS[id] }
}

/**
 * Closed-form unit-step response of a damped mass/spring system.
 * The function is pure and seekable: elapsed time is the only runtime input.
 */
export function springResponse(parametersInput: SpringParameters, elapsedMs: number): number {
  const parameters = normalizeSpringParameters(parametersInput)
  const time = nonNegative(elapsedMs, 'Spring elapsedMs') / 1_000
  if (time === 0) return 0

  const omega0 = Math.sqrt(parameters.stiffness / parameters.mass)
  const zeta = parameters.damping / (2 * Math.sqrt(parameters.stiffness * parameters.mass))
  const epsilon = 1e-7

  if (zeta < 1 - epsilon) {
    const root = Math.sqrt(1 - zeta * zeta)
    const omegaD = omega0 * root
    const envelope = Math.exp(-zeta * omega0 * time)
    return 1 - envelope * (
      Math.cos(omegaD * time) + (zeta / root) * Math.sin(omegaD * time)
    )
  }

  if (Math.abs(zeta - 1) <= epsilon) {
    return 1 - Math.exp(-omega0 * time) * (1 + omega0 * time)
  }

  const root = Math.sqrt(zeta * zeta - 1)
  const r1 = -omega0 * (zeta - root)
  const r2 = -omega0 * (zeta + root)
  const y0 = -1
  const a = (-r2 * y0) / (r1 - r2)
  const b = y0 - a
  return 1 + a * Math.exp(r1 * time) + b * Math.exp(r2 * time)
}

export function normalizeSpringFaceTransitionDefinition(value: unknown): SpringFaceTransitionDefinition {
  if (!isRecord(value)) throw new TypeError('Spring face transition must be an object')
  if (value.kind !== SPRING_FACE_TRANSITION_KIND) {
    throw new RangeError(`Unsupported spring transition kind: ${String(value.kind)}`)
  }

  let from: FaceModel | undefined
  if (value.from !== undefined) {
    if (!isRecord(value.from)) throw new TypeError('Spring transition from must be a FaceModel')
    from = structuredClone(value.from) as unknown as FaceModel
    // Reuse the established transition safety validation without changing state.
    resolveFaceStateTarget(from, {})
  }

  return {
    kind: SPRING_FACE_TRANSITION_KIND,
    id: nonEmptyString(value.id, 'Spring transition id'),
    startTimeMs: nonNegative(value.startTimeMs, 'Spring transition startTimeMs'),
    durationMs: nonNegative(value.durationMs, 'Spring transition durationMs'),
    spring: normalizeSpringParameters(value.spring),
    target: normalizeFaceStateTarget(value.target ?? {}),
    ...(from === undefined ? {} : { from: cloneFaceModel(from) }),
  }
}

export function createSpringFaceTransition(
  id: string,
  target: FaceStateTarget,
  startTimeMs: number,
  durationMs: number,
  spring: SpringParameters = SPRING_PRESETS.gentle,
  from?: FaceModel,
): SpringFaceTransitionDefinition {
  return normalizeSpringFaceTransitionDefinition({
    kind: SPRING_FACE_TRANSITION_KIND,
    id,
    target,
    startTimeMs,
    durationMs,
    spring,
    ...(from === undefined ? {} : { from }),
  })
}

export function springTransitionProgress(
  transitionInput: SpringFaceTransitionDefinition,
  timeMs: number,
): number {
  const transition = normalizeSpringFaceTransitionDefinition(transitionInput)
  const sampleTime = nonNegative(timeMs, 'Spring transition sample time')
  if (sampleTime <= transition.startTimeMs) return 0
  if (transition.durationMs === 0 || sampleTime >= transition.startTimeMs + transition.durationMs) return 1
  return springResponse(transition.spring, sampleTime - transition.startTimeMs)
}

/**
 * Sample through the same generic FaceModel surface as easing transitions.
 * Physical Spring overshoot remains visible when it is safe. Safety is applied
 * to the resolved FaceModel instead of flattening the Spring response itself.
 */
export function sampleSpringFaceTransition(
  transitionInput: SpringFaceTransitionDefinition,
  baseModel: FaceModel,
  timeMs: number,
): FaceModel {
  const transition = normalizeSpringFaceTransitionDefinition(transitionInput)
  const source = transition.from === undefined ? cloneFaceModel(baseModel) : cloneFaceModel(transition.from)
  const target = resolveFaceStateTarget(source, transition.target)
  const progress = springTransitionProgress(transition, timeMs)
  if (progress <= 0) return source
  if (progress === 1 && timeMs >= transition.startTimeMs + transition.durationMs) return target
  return interpolateSpringFaceModel(source, target, progress)
}

/** One generic sampler for both existing easing and spring transition definitions. */
export function sampleGenericFaceTransition(
  transition: GenericFaceTransitionDefinition,
  baseModel: FaceModel,
  timeMs: number,
): FaceModel {
  return transition.kind === FACE_TRANSITION_KIND
    ? sampleFaceTransition(transition, baseModel, timeMs)
    : sampleSpringFaceTransition(transition, baseModel, timeMs)
}

export function retargetSpringFaceTransition(
  transitionInput: SpringFaceTransitionDefinition,
  baseModel: FaceModel,
  target: FaceStateTarget,
  atTimeMs: number,
  options: RetargetGenericTransitionOptions = {},
): SpringFaceTransitionDefinition {
  const transition = normalizeSpringFaceTransitionDefinition(transitionInput)
  const rebaseTime = nonNegative(atTimeMs, 'Spring transition retarget time')
  const current = sampleSpringFaceTransition(transition, baseModel, rebaseTime)
  return createSpringFaceTransition(
    options.id ?? transition.id,
    target,
    rebaseTime,
    options.durationMs ?? transition.durationMs,
    options.spring ?? transition.spring,
    current,
  )
}

/** Runtime channel resolver for serialized spring transition authoring data. */
export const springStateTransitionChannelResolver: AnimationChannelResolver = ({
  channelDefinition,
  model,
  context,
}) => {
  if (channelDefinition === undefined) return model
  return sampleSpringFaceTransition(
    normalizeSpringFaceTransitionDefinition(channelDefinition),
    model,
    context.timeMs,
  )
}

/** Runtime resolver that dispatches serialized easing/Spring state transitions by kind. */
export const genericStateTransitionChannelResolver: AnimationChannelResolver = ({
  channelDefinition,
  model,
  context,
}) => {
  if (channelDefinition === undefined) return model
  if (!isRecord(channelDefinition)) throw new TypeError('State transition channel definition must be an object')
  return channelDefinition.kind === SPRING_FACE_TRANSITION_KIND
    ? sampleSpringFaceTransition(normalizeSpringFaceTransitionDefinition(channelDefinition), model, context.timeMs)
    : sampleFaceTransition(channelDefinition as unknown as FaceTransitionDefinition, model, context.timeMs)
}
