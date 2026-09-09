import type { FaceModel } from '../core/model'
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
  /** Reference-space values based on the RoboEyes 64 px-tall display behavior. */
  minTargetY?: number
  maxTargetY?: number
  /** Reference-space pixels per millisecond; scaled with canvas height at sampling time. */
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

const REFERENCE_CANVAS_HEIGHT = 64
const REFERENCE_CANVAS_WIDTH = 128
const SWEAT_START_Y = 2
const SWEAT_INITIAL_WIDTH = 1.8
const SWEAT_INITIAL_HEIGHT = 3.2
const SWEAT_GROWTH_RATE = 0.028
const SWEAT_WIDTH_SHRINK_RATE = 0.004
const SWEAT_HEIGHT_SHRINK_RATE = 0.022
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

function canvasScale(model: FaceModel): number {
  if (model.canvas.height <= 0) return 1
  return Math.max(0.5, model.canvas.height / REFERENCE_CANVAS_HEIGHT)
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
): number {
  const scale = canvasScale(model)
  const startY = SWEAT_START_Y * scale
  const canvasMax = Math.max(startY, model.canvas.height)
  const min = Math.min(canvasMax, Math.max(startY, definition.minTargetY * scale))
  const max = Math.min(canvasMax, Math.max(min, definition.maxTargetY * scale))
  return sampleRandomRange(seed, `transient:${definition.id}:drop-${dropIndex}:target-y`, cycleIndex, min, max)
}

function cycleDurationMs(definition: NormalizedSweatEffectDefinition, targetY: number, scale: number): number {
  const startY = SWEAT_START_Y * scale
  return Math.max(1, (Math.max(startY, targetY) - startY) / (definition.fallSpeed * scale))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sweatOverlayAtTime(
  definition: NormalizedSweatEffectDefinition,
  model: FaceModel,
  seed: number,
  dropIndex: number,
  epochStartTimeMs: number,
  timeMs: number,
): TeardropTransientOverlay | undefined {
  const scale = canvasScale(model)
  const startY = SWEAT_START_Y * scale
  if (model.canvas.width <= 0 || model.canvas.height <= startY) return undefined

  let cycleStartTimeMs = epochStartTimeMs
  let cycleIndex = 0
  let targetY = sampledTargetY(definition, model, seed, dropIndex, cycleIndex)
  let durationMs = cycleDurationMs(definition, targetY, scale)

  while (timeMs >= cycleStartTimeMs + durationMs) {
    cycleStartTimeMs += durationMs
    cycleIndex += 1
    if (cycleIndex >= MAX_SWEAT_CYCLES) {
      throw new RangeError(`Sweat effect exceeds max cycles (${MAX_SWEAT_CYCLES}) before requested time`)
    }
    targetY = sampledTargetY(definition, model, seed, dropIndex, cycleIndex)
    durationMs = cycleDurationMs(definition, targetY, scale)
  }

  const elapsedMs = Math.max(0, timeMs - cycleStartTimeMs)
  const fallSpeed = definition.fallSpeed * scale
  const y = Math.min(targetY, startY + fallSpeed * elapsedMs)
  const growthEndY = Math.max(startY, targetY / 2)
  const growthDurationMs = Math.max(0, (growthEndY - startY) / fallSpeed)
  const growthElapsedMs = Math.min(elapsedMs, growthDurationMs)
  const shrinkElapsedMs = Math.max(0, elapsedMs - growthDurationMs)
  const widthAtGrowthEnd = (SWEAT_INITIAL_WIDTH + SWEAT_GROWTH_RATE * growthElapsedMs) * scale
  const heightAtGrowthEnd = (SWEAT_INITIAL_HEIGHT + SWEAT_GROWTH_RATE * growthElapsedMs) * scale
  const rawWidth = shrinkElapsedMs === 0
    ? (SWEAT_INITIAL_WIDTH + SWEAT_GROWTH_RATE * elapsedMs) * scale
    : widthAtGrowthEnd - SWEAT_WIDTH_SHRINK_RATE * shrinkElapsedMs * scale
  const rawHeight = shrinkElapsedMs === 0
    ? (SWEAT_INITIAL_HEIGHT + SWEAT_GROWTH_RATE * elapsedMs) * scale
    : heightAtGrowthEnd - SWEAT_HEIGHT_SHRINK_RATE * shrinkElapsedMs * scale
  const width = clamp(rawWidth, 0, model.canvas.width)
  const height = clamp(rawHeight, 0, Math.max(0, model.canvas.height - y))
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
