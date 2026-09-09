import type { EyeGeometry, FaceModel } from '../core/model'
import { normalizeAnimationSeed, sampleRandomRange } from './random'
import {
  compareRuntimeAnimationEvents,
  normalizeRuntimeAnimationEvents,
  type JsonValue,
  type NormalizedRuntimeAnimationEvent,
  type RuntimeAnimationEvent,
} from './runtime'

export const TRANSIENT_EFFECT_LAYER_KIND = 'transient-effect-layer' as const
export const SWEAT_EFFECT_KIND = 'sweat' as const
export const TRANSIENT_OVERLAY_ROUNDED_RECT = 'rounded-rect' as const
export const TRANSIENT_OVERLAY_TEARDROP = 'teardrop' as const

export const SWEAT_CONTROL_ACTIONS = ['sweat-enable', 'sweat-disable'] as const
export type SweatControlAction = typeof SWEAT_CONTROL_ACTIONS[number]

export type TransientOverlayPaint =
  | { role: 'eye' | 'stroke' | 'background' }
  | { value: string }

type BaseTransientOverlay = {
  id: string
  x: number
  y: number
  width: number
  height: number
  paint: TransientOverlayPaint
  opacity?: number
}

export type RoundedRectTransientOverlay = BaseTransientOverlay & {
  kind: typeof TRANSIENT_OVERLAY_ROUNDED_RECT
  radius: number
}

export type TeardropTransientOverlay = BaseTransientOverlay & {
  kind: typeof TRANSIENT_OVERLAY_TEARDROP
  /** Generic shape control in the 0..1 range. Higher values produce a rounder bulb. */
  roundness: number
}

export type TransientOverlay = RoundedRectTransientOverlay | TeardropTransientOverlay

export type TransientEffectFrame = {
  overlays: readonly TransientOverlay[]
}

export const EMPTY_TRANSIENT_EFFECT_FRAME: Readonly<TransientEffectFrame> = Object.freeze({ overlays: [] })

export type SweatEffectDefinition = {
  kind: typeof SWEAT_EFFECT_KIND
  id: string
  enabled?: boolean
  startTimeMs?: number
  dropCount?: number
  /** Reference-space values based on the RoboEyes 128x64 / 36px-eye geometry. */
  minTargetY?: number
  maxTargetY?: number
  /** Logical canvas pixels per millisecond. */
  fallSpeed?: number
  /** Controls the generic teardrop bulb roundness. */
  radius?: number
}

export type TransientEffectDefinition = SweatEffectDefinition

export type TransientEffectLayerDefinition = {
  kind: typeof TRANSIENT_EFFECT_LAYER_KIND
  effects: TransientEffectDefinition[]
}

export type NormalizedSweatEffectDefinition = Required<SweatEffectDefinition>
export type NormalizedTransientEffectLayerDefinition = {
  kind: typeof TRANSIENT_EFFECT_LAYER_KIND
  effects: NormalizedSweatEffectDefinition[]
}

export const DEFAULT_SWEAT_EFFECT: Readonly<NormalizedSweatEffectDefinition> = Object.freeze({
  kind: SWEAT_EFFECT_KIND,
  id: 'sweat',
  enabled: false,
  startTimeMs: 0,
  dropCount: 3,
  minTargetY: 10,
  maxTargetY: 20,
  // FluxGarage increments Y by 0.5 per rendered frame. Phase 3 maps that
  // reference feel onto the established 50 Hz nominal cadence: 0.5 / 20 ms.
  fallSpeed: 0.025,
  radius: 3,
})

const REFERENCE_CANVAS_WIDTH = 128
const REFERENCE_EYE_SIZE = 36
const SWEAT_START_Y = 2
const SWEAT_INITIAL_WIDTH = 1.95
const SWEAT_INITIAL_HEIGHT = 3.6
const SWEAT_PEAK_WIDTH = 4.05
const SWEAT_PEAK_HEIGHT = 7.5
const SWEAT_FINAL_WIDTH = 1.425
const SWEAT_FINAL_HEIGHT = 2.7
const SWEAT_GROWTH_END_PROGRESS = 0.55
const SWEAT_EYE_MARGIN = 1.5
const SWEAT_REFERENCE_CYCLE_TRAVEL = 10
const MAX_SWEAT_CYCLES = 10_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new RangeError(`${label} contains unsupported field: ${key}`)
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`)
  return value
}

function nonNegativeFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return Object.is(value, -0) ? 0 : value
}

function positiveFinite(value: unknown, label: string): number {
  const result = nonNegativeFinite(value, label)
  if (result <= 0) throw new RangeError(`${label} must be greater than zero`)
  return result
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value as number
}

function normalizeSweatEffect(value: unknown): NormalizedSweatEffectDefinition {
  if (!isRecord(value)) throw new TypeError('Sweat effect definition must be an object')
  assertAllowedKeys(
    value,
    ['kind', 'id', 'enabled', 'startTimeMs', 'dropCount', 'minTargetY', 'maxTargetY', 'fallSpeed', 'radius'],
    'Sweat effect definition',
  )
  if (value.kind !== SWEAT_EFFECT_KIND) {
    throw new RangeError(`Unsupported transient effect kind: ${String(value.kind)}`)
  }
  const enabled = value.enabled ?? DEFAULT_SWEAT_EFFECT.enabled
  if (typeof enabled !== 'boolean') throw new TypeError('Sweat effect enabled must be boolean')
  const minTargetY = value.minTargetY === undefined
    ? DEFAULT_SWEAT_EFFECT.minTargetY
    : nonNegativeFinite(value.minTargetY, 'Sweat minTargetY')
  const maxTargetY = value.maxTargetY === undefined
    ? DEFAULT_SWEAT_EFFECT.maxTargetY
    : nonNegativeFinite(value.maxTargetY, 'Sweat maxTargetY')
  if (maxTargetY < minTargetY) throw new RangeError('Sweat maxTargetY must be >= minTargetY')

  return {
    kind: SWEAT_EFFECT_KIND,
    id: value.id === undefined ? DEFAULT_SWEAT_EFFECT.id : nonEmptyString(value.id, 'Sweat effect id'),
    enabled,
    startTimeMs: value.startTimeMs === undefined
      ? DEFAULT_SWEAT_EFFECT.startTimeMs
      : nonNegativeFinite(value.startTimeMs, 'Sweat startTimeMs'),
    dropCount: value.dropCount === undefined
      ? DEFAULT_SWEAT_EFFECT.dropCount
      : positiveInteger(value.dropCount, 'Sweat dropCount'),
    minTargetY,
    maxTargetY,
    fallSpeed: value.fallSpeed === undefined
      ? DEFAULT_SWEAT_EFFECT.fallSpeed
      : positiveFinite(value.fallSpeed, 'Sweat fallSpeed'),
    radius: value.radius === undefined
      ? DEFAULT_SWEAT_EFFECT.radius
      : nonNegativeFinite(value.radius, 'Sweat radius'),
  }
}

export function normalizeTransientEffectLayerDefinition(value: unknown): NormalizedTransientEffectLayerDefinition {
  if (!isRecord(value)) throw new TypeError('Transient effect layer definition must be an object')
  assertAllowedKeys(value, ['kind', 'effects'], 'Transient effect layer definition')
  if (value.kind !== TRANSIENT_EFFECT_LAYER_KIND) {
    throw new RangeError(`Unsupported transient effect layer kind: ${String(value.kind)}`)
  }
  if (!Array.isArray(value.effects)) throw new TypeError('Transient effect layer effects must be an array')

  const effects = value.effects.map(normalizeSweatEffect)
  const ids = new Set<string>()
  for (const effect of effects) {
    if (ids.has(effect.id)) throw new RangeError(`Transient effect ids must be unique: ${effect.id}`)
    ids.add(effect.id)
  }
  return { kind: TRANSIENT_EFFECT_LAYER_KIND, effects }
}

export function isSweatControlAction(action: string): action is SweatControlAction {
  return (SWEAT_CONTROL_ACTIONS as readonly string[]).includes(action)
}

type SweatEpoch = {
  enabled: boolean
  startTimeMs: number
}

function sweatEpochAtTime(
  definition: NormalizedSweatEffectDefinition,
  events: readonly NormalizedRuntimeAnimationEvent[],
  timeMs: number,
): SweatEpoch {
  let epoch: SweatEpoch = {
    enabled: definition.enabled && definition.startTimeMs <= timeMs,
    startTimeMs: definition.startTimeMs,
  }
  const controls = events
    .filter((event) => event.startTimeMs <= timeMs && isSweatControlAction(event.action))
    .slice()
    .sort(compareRuntimeAnimationEvents)

  for (const event of controls) {
    epoch = event.action === 'sweat-disable'
      ? { enabled: false, startTimeMs: event.startTimeMs }
      : { enabled: true, startTimeMs: event.startTimeMs }
  }
  return epoch
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress, 0, 1)
}

function eyeReferenceRatio(model: FaceModel): number {
  const leftSize = Math.max(1, Math.min(model.leftEye.geometry.width, model.leftEye.geometry.height))
  const rightSize = Math.max(1, Math.min(model.rightEye.geometry.width, model.rightEye.geometry.height))
  return ((leftSize + rightSize) / 2) / REFERENCE_EYE_SIZE
}

function sweatMotionScale(model: FaceModel): number {
  return clamp(eyeReferenceRatio(model), 0.5, 4)
}

function sweatSizeScale(model: FaceModel): number {
  // Size follows the face rather than the canvas, but deliberately weakly so
  // large eyes do not turn the transient symbol into a dominant foreground blob.
  return clamp(0.75 + eyeReferenceRatio(model) * 0.25, 0.65, 1.4)
}

function eyeVerticalHalfExtent(geometry: EyeGeometry): number {
  const radians = geometry.rotation * Math.PI / 180
  return Math.abs(Math.sin(radians)) * geometry.width / 2 +
    Math.abs(Math.cos(radians)) * geometry.height / 2
}

function eyeTopY(model: FaceModel, geometry: EyeGeometry): number {
  return geometry.position.y + model.gaze.y - eyeVerticalHalfExtent(geometry)
}

function sweatSafeBottom(model: FaceModel, sizeScale: number): number {
  const eyeTop = Math.min(
    eyeTopY(model, model.leftEye.geometry),
    eyeTopY(model, model.rightEye.geometry),
  )
  return Math.min(model.canvas.height, eyeTop - SWEAT_EYE_MARGIN * sizeScale)
}

function sweatXRange(width: number, dropIndex: number, dropCount: number): { min: number; max: number } {
  if (dropCount === 3 && width > 0) {
    const edge = width * (30 / REFERENCE_CANVAS_WIDTH)
    if (dropIndex === 0) return { min: 0, max: edge }
    if (dropIndex === 1) return { min: edge, max: width - edge }
    return { min: width - edge, max: width }
  }
  return {
    min: width * (dropIndex / dropCount),
    max: width * ((dropIndex + 1) / dropCount),
  }
}

function sampledTargetY(
  definition: NormalizedSweatEffectDefinition,
  model: FaceModel,
  seed: number,
  dropIndex: number,
  cycleIndex: number,
  startY: number,
  maxTargetY: number,
): number {
  const motionScale = sweatMotionScale(model)
  const min = Math.min(maxTargetY, Math.max(startY, definition.minTargetY * motionScale))
  const max = Math.min(maxTargetY, Math.max(min, definition.maxTargetY * motionScale))
  return sampleRandomRange(seed, `transient:${definition.id}:drop-${dropIndex}:target-y`, cycleIndex, min, max)
}

function fallDurationMs(
  definition: NormalizedSweatEffectDefinition,
  startY: number,
  targetY: number,
): number {
  return Math.max(1, (Math.max(startY, targetY) - startY) / definition.fallSpeed)
}

function cycleDurationMs(
  definition: NormalizedSweatEffectDefinition,
  motionScale: number,
  activeDurationMs: number,
): number {
  const referenceCycleMs = SWEAT_REFERENCE_CYCLE_TRAVEL * motionScale / definition.fallSpeed
  return Math.max(activeDurationMs, referenceCycleMs)
}

function sweatSizeAtProgress(progress: number, sizeScale: number): { width: number; height: number } {
  if (progress <= SWEAT_GROWTH_END_PROGRESS) {
    const growth = progress / SWEAT_GROWTH_END_PROGRESS
    return {
      width: interpolate(SWEAT_INITIAL_WIDTH, SWEAT_PEAK_WIDTH, growth) * sizeScale,
      height: interpolate(SWEAT_INITIAL_HEIGHT, SWEAT_PEAK_HEIGHT, growth) * sizeScale,
    }
  }
  const shrink = (progress - SWEAT_GROWTH_END_PROGRESS) / (1 - SWEAT_GROWTH_END_PROGRESS)
  return {
    width: interpolate(SWEAT_PEAK_WIDTH, SWEAT_FINAL_WIDTH, shrink) * sizeScale,
    height: interpolate(SWEAT_PEAK_HEIGHT, SWEAT_FINAL_HEIGHT, shrink) * sizeScale,
  }
}

function sweatOverlayAtTime(
  definition: NormalizedSweatEffectDefinition,
  model: FaceModel,
  seed: number,
  dropIndex: number,
  epochStartTimeMs: number,
  timeMs: number,
): TeardropTransientOverlay | undefined {
  const motionScale = sweatMotionScale(model)
  const sizeScale = sweatSizeScale(model)
  const startY = SWEAT_START_Y * motionScale
  const safeBottom = sweatSafeBottom(model, sizeScale)
  const maxTargetY = safeBottom - SWEAT_PEAK_HEIGHT * sizeScale
  if (model.canvas.width <= 0 || model.canvas.height <= startY || maxTargetY <= startY) return undefined

  let cycleStartTimeMs = epochStartTimeMs
  let cycleIndex = 0
  let targetY = sampledTargetY(definition, model, seed, dropIndex, cycleIndex, startY, maxTargetY)
  let activeDurationMs = fallDurationMs(definition, startY, targetY)
  let durationMs = cycleDurationMs(definition, motionScale, activeDurationMs)

  while (timeMs >= cycleStartTimeMs + durationMs) {
    cycleStartTimeMs += durationMs
    cycleIndex += 1
    if (cycleIndex >= MAX_SWEAT_CYCLES) {
      throw new RangeError(`Sweat effect exceeds max cycles (${MAX_SWEAT_CYCLES}) before requested time`)
    }
    targetY = sampledTargetY(definition, model, seed, dropIndex, cycleIndex, startY, maxTargetY)
    activeDurationMs = fallDurationMs(definition, startY, targetY)
    durationMs = cycleDurationMs(definition, motionScale, activeDurationMs)
  }

  const elapsedMs = Math.max(0, timeMs - cycleStartTimeMs)
  if (elapsedMs >= activeDurationMs) return undefined

  const progress = clamp(elapsedMs / activeDurationMs, 0, 1)
  const y = interpolate(startY, targetY, progress)
  const size = sweatSizeAtProgress(progress, sizeScale)
  const width = clamp(size.width, 0, model.canvas.width)
  const height = clamp(size.height, 0, Math.max(0, safeBottom - y))
  if (width <= 0 || height <= 0) return undefined

  const range = sweatXRange(model.canvas.width, dropIndex, definition.dropCount)
  const centerX = sampleRandomRange(
    seed,
    `transient:${definition.id}:drop-${dropIndex}:x`,
    cycleIndex,
    range.min,
    range.max,
  )
  const x = clamp(centerX - width / 2, 0, Math.max(0, model.canvas.width - width))

  return {
    id: `${definition.id}:drop-${dropIndex}:cycle-${cycleIndex}`,
    kind: TRANSIENT_OVERLAY_TEARDROP,
    x,
    y,
    width,
    height,
    roundness: clamp(definition.radius / 4, 0.35, 1),
    paint: { role: 'eye' },
  }
}

function fallbackLayerForEvents(events: readonly NormalizedRuntimeAnimationEvent[]): NormalizedTransientEffectLayerDefinition {
  const hasSweatControl = events.some((event) => isSweatControlAction(event.action))
  return {
    kind: TRANSIENT_EFFECT_LAYER_KIND,
    effects: hasSweatControl ? [{ ...DEFAULT_SWEAT_EFFECT }] : [],
  }
}

export function resolveTransientEffectFrame(
  layerInput: JsonValue | TransientEffectLayerDefinition | undefined,
  eventsInput: readonly RuntimeAnimationEvent[],
  model: FaceModel,
  timeMs: number,
  seed: number,
): TransientEffectFrame {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new RangeError('Transient effect sample time must be finite and non-negative')
  }
  const normalizedSeed = normalizeAnimationSeed(seed)
  const events = normalizeRuntimeAnimationEvents(eventsInput)
    .filter((event) => event.channel === 'transient-effect' && event.startTimeMs <= timeMs)
  const layer = layerInput === undefined
    ? fallbackLayerForEvents(events)
    : normalizeTransientEffectLayerDefinition(layerInput)
  const overlays: TransientOverlay[] = []

  for (const effect of layer.effects) {
    const epoch = sweatEpochAtTime(effect, events, timeMs)
    if (!epoch.enabled || epoch.startTimeMs > timeMs) continue
    for (let dropIndex = 0; dropIndex < effect.dropCount; dropIndex += 1) {
      const overlay = sweatOverlayAtTime(effect, model, normalizedSeed, dropIndex, epoch.startTimeMs, timeMs)
      if (overlay !== undefined) overlays.push(overlay)
    }
  }

  return { overlays }
}