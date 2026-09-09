import {
  areEyeLidAperturesValid,
  canFitEyesInCanvas,
  clampGaze,
  gazeLimits,
  isGazeCanvasSafe,
  resolveEyeExpression,
  type ExpressionModel,
  type EyeExpression,
  type EyeGeometry,
  type EyeVisibilityModel,
  type FaceModel,
  type Point,
} from '../core/model'
import { applyEasing, isEasingId, type EasingId } from './easing'
import {
  cloneFaceModel,
  type AnimationChannelResolver,
  type JsonValue,
} from './runtime'

export const FACE_TRANSITION_KIND = 'face-model-transition' as const

export type EyeStateTarget = {
  geometry?: Partial<Omit<EyeGeometry, 'position'>> & {
    position?: Partial<Point>
  }
}

/**
 * Animatable Phase 1/2 surface. Canvas, colors, and eye visibility are deliberately absent:
 * they remain discrete/static unless a later issue explicitly adds transition semantics.
 */
export type FaceStateTarget = {
  gaze?: Partial<Point>
  leftEye?: EyeStateTarget
  rightEye?: EyeStateTarget
  /** Edge-to-edge horizontal spacing. Applied symmetrically around the eye midpoint. */
  eyeSpacing?: number
  /** Full generic expression replacement; expression names are not part of transition logic. */
  expression?: ExpressionModel
}

export type FaceTransitionDefinition = {
  kind: typeof FACE_TRANSITION_KIND
  /** Stable caller/authored identity suitable for later sequence/preset persistence. */
  id: string
  startTimeMs: number
  durationMs: number
  easing: EasingId
  target: FaceStateTarget
  /**
   * Optional explicit rebase source. Normal authored transitions may omit it and
   * start from the evaluator's current/base model. Retargeted transitions set it.
   */
  from?: FaceModel
}

export type RetargetFaceTransitionOptions = {
  id?: string
  durationMs?: number
  easing?: EasingId
}

export const GAZE_DIRECTIONS = [
  'center',
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
] as const

export type GazeDirection = typeof GAZE_DIRECTIONS[number]

export const ROBOEYES_GAZE_POSITIONS = [
  'DEFAULT',
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
] as const

export type RoboEyesGazePosition = typeof ROBOEYES_GAZE_POSITIONS[number]

const EYE_EXPRESSION_KEYS: readonly (keyof Required<EyeExpression>)[] = [
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

const SHARED_EXPRESSION_DEFAULTS: Required<EyeExpression> = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function nonNegativeNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number < 0) throw new RangeError(`${label} must be non-negative`)
  return number
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

function optionalFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number | undefined {
  if (!(key in record) || record[key] === undefined) return undefined
  return finiteNumber(record[key], label)
}

function cloneExpression(expression: ExpressionModel): ExpressionModel {
  return {
    ...expression,
    leftEye: expression.leftEye === undefined ? undefined : { ...expression.leftEye },
    rightEye: expression.rightEye === undefined ? undefined : { ...expression.rightEye },
  }
}

function assertExpression(expression: ExpressionModel, label: string): void {
  for (const side of ['left', 'right'] as const) {
    const resolved = resolveEyeExpression(expression, side)
    for (const key of EYE_EXPRESSION_KEYS) {
      if (!Number.isFinite(resolved[key])) {
        throw new TypeError(`${label}.${side}.${key} must be finite`)
      }
    }
  }
  if (!areEyeLidAperturesValid(expression)) {
    throw new RangeError(`${label} must not invert the visible eyelid aperture`)
  }
}

function parseExpression(value: unknown, label: string): ExpressionModel {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)

  const upperLid = finiteNumber(value.upperLid, `${label}.upperLid`)
  const lowerLid = finiteNumber(value.lowerLid, `${label}.lowerLid`)
  const tilt = finiteNumber(value.tilt, `${label}.tilt`)
  const expression: ExpressionModel = { upperLid, lowerLid, tilt }

  for (const key of [
    'upperLidInner',
    'upperLidOuter',
    'lowerLidCurvature',
    'heightScale',
    'gazeHeightExpansion',
    'gazeHeightThreshold',
  ] as const) {
    const parsed = optionalFiniteNumber(value, key, `${label}.${key}`)
    if (parsed !== undefined) expression[key] = parsed
  }

  for (const sideKey of ['leftEye', 'rightEye'] as const) {
    const sideValue = value[sideKey]
    if (sideValue === undefined) continue
    if (!isRecord(sideValue)) throw new TypeError(`${label}.${sideKey} must be an object`)
    const override: Partial<EyeExpression> = {}
    for (const key of EYE_EXPRESSION_KEYS) {
      const parsed = optionalFiniteNumber(sideValue, key, `${label}.${sideKey}.${key}`)
      if (parsed !== undefined) override[key] = parsed
    }
    expression[sideKey] = override
  }

  assertExpression(expression, label)
  return expression
}

function parsePoint(value: unknown, label: string): Point {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  return {
    x: finiteNumber(value.x, `${label}.x`),
    y: finiteNumber(value.y, `${label}.y`),
  }
}

function parseGeometry(value: unknown, label: string): EyeGeometry {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  return {
    position: parsePoint(value.position, `${label}.position`),
    width: nonNegativeNumber(value.width, `${label}.width`),
    height: nonNegativeNumber(value.height, `${label}.height`),
    cornerRadius: nonNegativeNumber(value.cornerRadius, `${label}.cornerRadius`),
    rotation: finiteNumber(value.rotation, `${label}.rotation`),
  }
}

function parseEyeVisibility(value: unknown, label: string): EyeVisibilityModel {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  if (typeof value.left !== 'boolean' || typeof value.right !== 'boolean') {
    throw new TypeError(`${label} left/right must be boolean`)
  }
  return { left: value.left, right: value.right }
}

function parseFaceModel(value: unknown, label: string): FaceModel {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  if (!isRecord(value.canvas)) throw new TypeError(`${label}.canvas must be an object`)
  if (!isRecord(value.leftEye)) throw new TypeError(`${label}.leftEye must be an object`)
  if (!isRecord(value.rightEye)) throw new TypeError(`${label}.rightEye must be an object`)
  if (!isRecord(value.colors)) throw new TypeError(`${label}.colors must be an object`)

  const eyeColor = nonEmptyString(value.colors.eye, `${label}.colors.eye`)
  const background = nonEmptyString(value.colors.background, `${label}.colors.background`)
  const stroke = value.colors.stroke === undefined
    ? undefined
    : nonEmptyString(value.colors.stroke, `${label}.colors.stroke`)

  const model: FaceModel = {
    canvas: {
      width: nonNegativeNumber(value.canvas.width, `${label}.canvas.width`),
      height: nonNegativeNumber(value.canvas.height, `${label}.canvas.height`),
    },
    leftEye: { geometry: parseGeometry(value.leftEye.geometry, `${label}.leftEye.geometry`) },
    rightEye: { geometry: parseGeometry(value.rightEye.geometry, `${label}.rightEye.geometry`) },
    gaze: parsePoint(value.gaze, `${label}.gaze`),
    expression: parseExpression(value.expression, `${label}.expression`),
    colors: {
      eye: eyeColor,
      background,
      ...(stroke === undefined ? {} : { stroke }),
    },
    ...(value.eyeVisibility === undefined
      ? {}
      : { eyeVisibility: parseEyeVisibility(value.eyeVisibility, `${label}.eyeVisibility`) }),
  }

  assertTransitionModel(model, label)
  return model
}

function parsePartialPoint(value: unknown, label: string): Partial<Point> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  const result: Partial<Point> = {}
  const x = optionalFiniteNumber(value, 'x', `${label}.x`)
  const y = optionalFiniteNumber(value, 'y', `${label}.y`)
  if (x !== undefined) result.x = x
  if (y !== undefined) result.y = y
  return result
}

function parseEyeTarget(value: unknown, label: string): EyeStateTarget {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  if (value.geometry === undefined) return {}
  if (!isRecord(value.geometry)) throw new TypeError(`${label}.geometry must be an object`)

  const geometry: EyeStateTarget['geometry'] = {}
  if (value.geometry.position !== undefined) {
    geometry.position = parsePartialPoint(value.geometry.position, `${label}.geometry.position`)
  }
  for (const key of ['width', 'height', 'cornerRadius', 'rotation'] as const) {
    const parsed = optionalFiniteNumber(value.geometry, key, `${label}.geometry.${key}`)
    if (parsed === undefined) continue
    if ((key === 'width' || key === 'height' || key === 'cornerRadius') && parsed < 0) {
      throw new RangeError(`${label}.geometry.${key} must be non-negative`)
    }
    geometry[key] = parsed
  }
  return { geometry }
}

export function normalizeFaceStateTarget(value: unknown): FaceStateTarget {
  if (!isRecord(value)) throw new TypeError('Face state target must be an object')
  const target: FaceStateTarget = {}

  if (value.gaze !== undefined) target.gaze = parsePartialPoint(value.gaze, 'Face state target gaze')
  if (value.leftEye !== undefined) target.leftEye = parseEyeTarget(value.leftEye, 'Face state target leftEye')
  if (value.rightEye !== undefined) target.rightEye = parseEyeTarget(value.rightEye, 'Face state target rightEye')
  if (value.eyeSpacing !== undefined) {
    target.eyeSpacing = finiteNumber(value.eyeSpacing, 'Face state target eyeSpacing')
  }
  if (value.expression !== undefined) {
    target.expression = parseExpression(value.expression, 'Face state target expression')
  }

  return target
}

export function normalizeFaceTransitionDefinition(value: unknown): FaceTransitionDefinition {
  if (!isRecord(value)) throw new TypeError('Face transition definition must be an object')
  if (value.kind !== FACE_TRANSITION_KIND) {
    throw new RangeError(`Unsupported face transition kind: ${String(value.kind)}`)
  }

  const easing = nonEmptyString(value.easing, 'Face transition easing')
  if (!isEasingId(easing)) throw new RangeError(`Unsupported easing id: ${easing}`)

  return {
    kind: FACE_TRANSITION_KIND,
    id: nonEmptyString(value.id, 'Face transition id'),
    startTimeMs: nonNegativeNumber(value.startTimeMs, 'Face transition startTimeMs'),
    durationMs: nonNegativeNumber(value.durationMs, 'Face transition durationMs'),
    easing,
    target: normalizeFaceStateTarget(value.target),
    ...(value.from === undefined ? {} : { from: parseFaceModel(value.from, 'Face transition from') }),
  }
}

function assertFiniteGeometry(geometry: EyeGeometry, label: string): void {
  for (const [name, value] of Object.entries({
    positionX: geometry.position.x,
    positionY: geometry.position.y,
    width: geometry.width,
    height: geometry.height,
    cornerRadius: geometry.cornerRadius,
    rotation: geometry.rotation,
  })) {
    if (!Number.isFinite(value)) throw new TypeError(`${label}.${name} must be finite`)
  }
  if (geometry.width < 0 || geometry.height < 0 || geometry.cornerRadius < 0) {
    throw new RangeError(`${label} dimensions/radius must be non-negative`)
  }
}

function assertTransitionModel(model: FaceModel, label: string): void {
  if (!Number.isFinite(model.canvas.width) || !Number.isFinite(model.canvas.height) ||
      model.canvas.width < 0 || model.canvas.height < 0) {
    throw new RangeError(`${label}.canvas must have finite non-negative dimensions`)
  }
  assertFiniteGeometry(model.leftEye.geometry, `${label}.leftEye.geometry`)
  assertFiniteGeometry(model.rightEye.geometry, `${label}.rightEye.geometry`)
  if (!Number.isFinite(model.gaze.x) || !Number.isFinite(model.gaze.y)) {
    throw new TypeError(`${label}.gaze must be finite`)
  }
  if (model.eyeVisibility !== undefined &&
      (typeof model.eyeVisibility.left !== 'boolean' || typeof model.eyeVisibility.right !== 'boolean')) {
    throw new TypeError(`${label}.eyeVisibility must contain boolean left/right values`)
  }
  assertExpression(model.expression, `${label}.expression`)
  if (!canFitEyesInCanvas(model)) {
    throw new RangeError(`${label} eye geometry cannot fit inside the canvas`)
  }
  if (!isGazeCanvasSafe(model)) {
    throw new RangeError(`${label} gaze is outside the safe canvas bounds`)
  }
}

function clampTransitionGaze(model: FaceModel): FaceModel {
  if (!canFitEyesInCanvas(model)) {
    throw new RangeError('Transition eye geometry cannot fit inside the canvas')
  }

  let current = cloneFaceModel(model)
  for (let index = 0; index < 8; index += 1) {
    const next = clampGaze(current)
    if (next.gaze.x === current.gaze.x && next.gaze.y === current.gaze.y) break
    current = next
  }

  if (!isGazeCanvasSafe(current)) {
    const centered = { ...current, gaze: { x: 0, y: 0 } }
    if (!isGazeCanvasSafe(centered)) {
      throw new RangeError('Transition frame cannot produce a canvas-safe gaze')
    }
    current = centered
  }
  return current
}

export function eyeSpacing(model: FaceModel): number {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  return right.position.x - left.position.x - left.width / 2 - right.width / 2
}

export function withEyeSpacing(model: FaceModel, spacing: number): FaceModel {
  const normalizedSpacing = finiteNumber(spacing, 'Eye spacing')
  const result = cloneFaceModel(model)
  const left = result.leftEye.geometry
  const right = result.rightEye.geometry
  const midpoint = (left.position.x + right.position.x) / 2
  const centerDistance = left.width / 2 + normalizedSpacing + right.width / 2
  left.position.x = midpoint - centerDistance / 2
  right.position.x = midpoint + centerDistance / 2
  return result
}

function applyGeometryTarget(geometry: EyeGeometry, target: EyeStateTarget | undefined): EyeGeometry {
  if (target?.geometry === undefined) {
    return { ...geometry, position: { ...geometry.position } }
  }
  const requested = target.geometry
  return {
    ...geometry,
    ...requested,
    position: {
      ...geometry.position,
      ...requested.position,
    },
  }
}

/** Resolve a partial authored state into a full, canvas-safe FaceModel. */
export function resolveFaceStateTarget(baseModel: FaceModel, targetInput: FaceStateTarget): FaceModel {
  assertTransitionModel(baseModel, 'Transition base model')
  const target = normalizeFaceStateTarget(targetInput)
  let result = cloneFaceModel(baseModel)

  result.leftEye.geometry = applyGeometryTarget(result.leftEye.geometry, target.leftEye)
  result.rightEye.geometry = applyGeometryTarget(result.rightEye.geometry, target.rightEye)
  if (target.eyeSpacing !== undefined) result = withEyeSpacing(result, target.eyeSpacing)
  if (target.gaze !== undefined) {
    result.gaze = {
      x: target.gaze.x ?? result.gaze.x,
      y: target.gaze.y ?? result.gaze.y,
    }
  }
  if (target.expression !== undefined) result.expression = cloneExpression(target.expression)

  result = clampTransitionGaze(result)
  assertTransitionModel(result, 'Resolved transition target')
  return result
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function interpolateNumber(from: number, to: number, progress: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(progress)) {
    throw new RangeError('Numeric interpolation inputs must be finite')
  }
  const t = Math.min(1, Math.max(0, progress))
  return lerp(from, to, t)
}

function interpolatePoint(from: Point, to: Point, progress: number): Point {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
  }
}

function interpolateGeometry(from: EyeGeometry, to: EyeGeometry, progress: number): EyeGeometry {
  return {
    position: interpolatePoint(from.position, to.position, progress),
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
  return expression[key] ?? SHARED_EXPRESSION_DEFAULTS[key]
}

function interpolateResolvedExpression(
  from: Required<EyeExpression>,
  to: Required<EyeExpression>,
  progress: number,
): Required<EyeExpression> {
  const result = {} as Required<EyeExpression>
  for (const key of EYE_EXPRESSION_KEYS) {
    result[key] = lerp(from[key], to[key], progress)
  }
  return result
}

/** Interpolate arbitrary generic expressions, including asymmetric per-eye overrides. */
export function interpolateExpressionModel(
  from: ExpressionModel,
  to: ExpressionModel,
  progress: number,
): ExpressionModel {
  const t = Math.min(1, Math.max(0, finiteNumber(progress, 'Expression interpolation progress')))
  if (t === 0) return cloneExpression(from)
  if (t === 1) return cloneExpression(to)

  const shared = {} as Required<EyeExpression>
  for (const key of EYE_EXPRESSION_KEYS) {
    shared[key] = lerp(sharedExpressionValue(from, key), sharedExpressionValue(to, key), t)
  }
  const leftEye = interpolateResolvedExpression(
    resolveEyeExpression(from, 'left'),
    resolveEyeExpression(to, 'left'),
    t,
  )
  const rightEye = interpolateResolvedExpression(
    resolveEyeExpression(from, 'right'),
    resolveEyeExpression(to, 'right'),
    t,
  )
  const expression: ExpressionModel = { ...shared, leftEye, rightEye }
  assertExpression(expression, 'Interpolated expression')
  return expression
}

/**
 * Interpolate the Phase 1/2 numeric animation surface. Canvas/colors/visibility stay from
 * the source model because they are explicitly discrete.
 */
export function interpolateFaceModel(
  fromModel: FaceModel,
  toModel: FaceModel,
  progress: number,
): FaceModel {
  assertTransitionModel(fromModel, 'Transition source model')
  assertTransitionModel(toModel, 'Transition target model')
  const t = Math.min(1, Math.max(0, finiteNumber(progress, 'Face interpolation progress')))
  if (t === 0) return cloneFaceModel(fromModel)
  if (t === 1) return cloneFaceModel(toModel)

  let result: FaceModel = {
    canvas: { ...fromModel.canvas },
    leftEye: { geometry: interpolateGeometry(fromModel.leftEye.geometry, toModel.leftEye.geometry, t) },
    rightEye: { geometry: interpolateGeometry(fromModel.rightEye.geometry, toModel.rightEye.geometry, t) },
    gaze: interpolatePoint(fromModel.gaze, toModel.gaze, t),
    expression: interpolateExpressionModel(fromModel.expression, toModel.expression, t),
    colors: { ...fromModel.colors },
    ...(fromModel.eyeVisibility === undefined ? {} : { eyeVisibility: { ...fromModel.eyeVisibility } }),
  }
  result = clampTransitionGaze(result)
  assertTransitionModel(result, 'Interpolated transition frame')
  return result
}

export function createFaceTransition(
  id: string,
  target: FaceStateTarget,
  startTimeMs: number,
  durationMs: number,
  easing: EasingId = 'ease-in-out',
  from?: FaceModel,
): FaceTransitionDefinition {
  return normalizeFaceTransitionDefinition({
    kind: FACE_TRANSITION_KIND,
    id,
    target,
    startTimeMs,
    durationMs,
    easing,
    ...(from === undefined ? {} : { from }),
  })
}

export function faceTransitionProgress(
  transitionInput: FaceTransitionDefinition,
  timeMs: number,
): number {
  const transition = normalizeFaceTransitionDefinition(transitionInput)
  const sampleTime = nonNegativeNumber(timeMs, 'Transition sample time')
  if (sampleTime <= transition.startTimeMs) return 0
  if (transition.durationMs === 0) return 1
  return Math.min(1, (sampleTime - transition.startTimeMs) / transition.durationMs)
}

/** Deterministically sample a transition at one explicit logical timestamp. */
export function sampleFaceTransition(
  transitionInput: FaceTransitionDefinition,
  baseModel: FaceModel,
  timeMs: number,
): FaceModel {
  const transition = normalizeFaceTransitionDefinition(transitionInput)
  const source = transition.from === undefined ? cloneFaceModel(baseModel) : cloneFaceModel(transition.from)
  assertTransitionModel(source, 'Transition source model')
  const target = resolveFaceStateTarget(source, transition.target)
  const linearProgress = faceTransitionProgress(transition, timeMs)
  if (linearProgress === 0) return source
  if (linearProgress === 1) return target
  return interpolateFaceModel(source, target, applyEasing(transition.easing, linearProgress))
}

/**
 * Rebase an interrupted transition from the exact model resolved at `atTimeMs`.
 * Sampling the returned transition at that same time therefore cannot snap.
 */
export function retargetFaceTransition(
  transitionInput: FaceTransitionDefinition,
  baseModel: FaceModel,
  target: FaceStateTarget,
  atTimeMs: number,
  options: RetargetFaceTransitionOptions = {},
): FaceTransitionDefinition {
  const transition = normalizeFaceTransitionDefinition(transitionInput)
  const rebaseTime = nonNegativeNumber(atTimeMs, 'Transition retarget time')
  const current = sampleFaceTransition(transition, baseModel, rebaseTime)
  return createFaceTransition(
    options.id ?? transition.id,
    target,
    rebaseTime,
    options.durationMs ?? transition.durationMs,
    options.easing ?? transition.easing,
    current,
  )
}

function normalizedAxis(value: number, label: string): number {
  return Math.min(1, Math.max(-1, finiteNumber(value, label)))
}

/** Convert normalized -1..1 gaze coordinates to the current canvas-safe range. */
export function normalizedGazeTarget(model: FaceModel, normalized: Point): Point {
  assertTransitionModel(model, 'Gaze target model')
  const nx = normalizedAxis(normalized.x, 'Normalized gaze x')
  const ny = normalizedAxis(normalized.y, 'Normalized gaze y')
  const centered = { ...cloneFaceModel(model), gaze: { x: 0, y: 0 } }
  const limits = gazeLimits(centered)
  const candidate = {
    ...centered,
    gaze: {
      x: nx < 0 ? -nx * limits.x.min : nx * limits.x.max,
      y: ny < 0 ? -ny * limits.y.min : ny * limits.y.max,
    },
  }
  return clampTransitionGaze(candidate).gaze
}

const DIRECTION_VECTORS: Record<GazeDirection, Point> = {
  center: { x: 0, y: 0 },
  up: { x: 0, y: -1 },
  'up-right': { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  'down-right': { x: 1, y: 1 },
  down: { x: 0, y: 1 },
  'down-left': { x: -1, y: 1 },
  left: { x: -1, y: 0 },
  'up-left': { x: -1, y: -1 },
}

const ROBOEYES_DIRECTION_MAP: Record<RoboEyesGazePosition, GazeDirection> = {
  DEFAULT: 'center',
  N: 'up',
  NE: 'up-right',
  E: 'right',
  SE: 'down-right',
  S: 'down',
  SW: 'down-left',
  W: 'left',
  NW: 'up-left',
}

export function gazeTargetForDirection(model: FaceModel, direction: GazeDirection): Point {
  return normalizedGazeTarget(model, DIRECTION_VECTORS[direction])
}

export function gazeTargetForRoboEyesPosition(
  model: FaceModel,
  position: RoboEyesGazePosition,
): Point {
  return gazeTargetForDirection(model, ROBOEYES_DIRECTION_MAP[position])
}

/** #98 state-transition channel adapter for the serializable definition above. */
export const stateTransitionChannelResolver: AnimationChannelResolver = ({
  model,
  channelDefinition,
  context,
}) => {
  if (channelDefinition === undefined) return model
  return sampleFaceTransition(
    normalizeFaceTransitionDefinition(channelDefinition as JsonValue),
    model,
    context.timeMs,
  )
}
