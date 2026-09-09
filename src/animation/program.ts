import type { FaceModel } from '../core/model'
import { applyEasing, isEasingId, type EasingId } from './easing'
import {
  ANIMATION_RUNTIME_CHANNELS,
  cloneFaceModel,
  isJsonValue,
  normalizeRuntimeAnimationEvents,
  type AnimationRuntimeChannel,
  type JsonObject,
  type NormalizedRuntimeAnimationEvent,
  type RuntimeAnimationEvent,
} from './runtime'
import { normalizeSpringParameters, springResponse, type SpringParameters } from './spring'
import {
  interpolateFaceModel,
  normalizeFaceStateTarget,
  resolveFaceStateTarget,
  type FaceStateTarget,
} from './transition'

export const ANIMATION_PROGRAM_VERSION = 1 as const
export const PROGRAM_PLAYBACK_MODES = ['once', 'loop', 'ping-pong'] as const
export type ProgramPlaybackMode = typeof PROGRAM_PLAYBACK_MODES[number]

export type ProgramAction = {
  id: string
  channel: AnimationRuntimeChannel
  action: string
  /** Offset from the beginning of this step's hold phase. */
  offsetMs?: number
  priority?: number
  payload?: JsonObject
}

export type AnimationProgramStep = {
  id: string
  target: FaceStateTarget
  /** Entry transition from the previous resolved state into this step target. */
  transitionDurationMs: number
  /** Existing easing remains the compatibility/default transition mode. */
  easing: EasingId
  /** When present, the entry transition uses these deterministic Spring parameters instead of easing. */
  spring?: SpringParameters
  holdDurationMs: number
  actions?: readonly ProgramAction[]
}

export type AnimationProgram = {
  version: typeof ANIMATION_PROGRAM_VERSION
  id: string
  name?: string
  playbackMode: ProgramPlaybackMode
  steps: readonly AnimationProgramStep[]
}

export type ProgramSamplePhase = 'transition' | 'hold' | 'complete'

export type SampledAnimationProgram = {
  model: FaceModel
  programTimeMs: number
  cycleIndex: number
  stepIndex: number
  stepId: string
  direction: 'forward' | 'reverse'
  phase: ProgramSamplePhase
  progress: number
  runtimeEvents: readonly NormalizedRuntimeAnimationEvent[]
}

type Visit = {
  stepIndex: number
  direction: 'forward' | 'reverse'
}

type VisitInstance = Visit & {
  cycleIndex: number
  visitIndex: number
  startTimeMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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

function safeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`)
  return value as number
}

function isPlaybackMode(value: unknown): value is ProgramPlaybackMode {
  return typeof value === 'string' && (PROGRAM_PLAYBACK_MODES as readonly string[]).includes(value)
}

function isRuntimeChannel(value: unknown): value is AnimationRuntimeChannel {
  return typeof value === 'string' && (ANIMATION_RUNTIME_CHANNELS as readonly string[]).includes(value)
}

function normalizeAction(value: unknown, stepId: string, actionIndex: number, holdDurationMs: number): ProgramAction {
  if (!isRecord(value)) throw new TypeError(`Program step ${stepId} action ${actionIndex} must be an object`)
  const channel = value.channel
  if (!isRuntimeChannel(channel)) throw new RangeError(`Program action channel is unsupported: ${String(channel)}`)
  const offsetMs = value.offsetMs === undefined ? 0 : nonNegativeFinite(value.offsetMs, 'Program action offsetMs')
  if (offsetMs > holdDurationMs) throw new RangeError('Program action offsetMs must not exceed step holdDurationMs')
  const priority = value.priority === undefined ? 0 : safeInteger(value.priority, 'Program action priority')
  if (value.payload !== undefined && (!isRecord(value.payload) || !isJsonValue(value.payload))) {
    throw new TypeError('Program action payload must be a JSON-safe object')
  }
  return {
    id: nonEmptyString(value.id, 'Program action id'),
    channel,
    action: nonEmptyString(value.action, 'Program action name'),
    offsetMs,
    priority,
    ...(value.payload === undefined ? {} : { payload: structuredClone(value.payload) as JsonObject }),
  }
}

function normalizeStep(value: unknown, stepIndex: number): AnimationProgramStep {
  if (!isRecord(value)) throw new TypeError(`Program step ${stepIndex} must be an object`)
  const id = nonEmptyString(value.id, `Program step ${stepIndex} id`)
  const transitionDurationMs = nonNegativeFinite(value.transitionDurationMs, `Program step ${id} transitionDurationMs`)
  const holdDurationMs = nonNegativeFinite(value.holdDurationMs, `Program step ${id} holdDurationMs`)
  if (typeof value.easing !== 'string' || !isEasingId(value.easing)) {
    throw new RangeError(`Program step ${id} easing must be a supported easing id`)
  }
  const spring = value.spring === undefined ? undefined : normalizeSpringParameters(value.spring)
  if (!Array.isArray(value.actions ?? [])) throw new TypeError(`Program step ${id} actions must be an array`)
  const actions = (value.actions as unknown[] | undefined ?? []).map((action, index) =>
    normalizeAction(action, id, index, holdDurationMs))
  const actionIds = actions.map((action) => action.id)
  if (new Set(actionIds).size !== actionIds.length) throw new RangeError(`Program step ${id} action ids must be unique`)

  return {
    id,
    target: normalizeFaceStateTarget(value.target ?? {}),
    transitionDurationMs,
    easing: value.easing,
    ...(spring === undefined ? {} : { spring }),
    holdDurationMs,
    ...(actions.length === 0 ? {} : { actions }),
  }
}

export function normalizeAnimationProgram(value: unknown): AnimationProgram {
  if (!isRecord(value)) throw new TypeError('Animation program must be an object')
  if (value.version !== ANIMATION_PROGRAM_VERSION) {
    throw new RangeError(`Unsupported animation program version: ${String(value.version)}`)
  }
  if (!isPlaybackMode(value.playbackMode)) {
    throw new RangeError(`Unsupported program playback mode: ${String(value.playbackMode)}`)
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    throw new RangeError('Animation program must contain at least one step')
  }
  const steps = value.steps.map(normalizeStep)
  const ids = steps.map((step) => step.id)
  if (new Set(ids).size !== ids.length) throw new RangeError('Animation program step ids must be unique')

  return {
    version: ANIMATION_PROGRAM_VERSION,
    id: nonEmptyString(value.id, 'Animation program id'),
    ...(value.name === undefined ? {} : { name: nonEmptyString(value.name, 'Animation program name') }),
    playbackMode: value.playbackMode,
    steps,
  }
}

function traversalFor(program: AnimationProgram): Visit[] {
  const forward = program.steps.map((_, stepIndex): Visit => ({ stepIndex, direction: 'forward' }))
  if (program.playbackMode !== 'ping-pong' || program.steps.length <= 2) return forward
  const reverse: Visit[] = []
  for (let stepIndex = program.steps.length - 2; stepIndex >= 1; stepIndex -= 1) {
    reverse.push({ stepIndex, direction: 'reverse' })
  }
  return [...forward, ...reverse]
}

function visitDuration(program: AnimationProgram, visit: Visit): number {
  const step = program.steps[visit.stepIndex]
  return step.transitionDurationMs + step.holdDurationMs
}

/** Once duration, or one repeat cycle duration for loop/ping-pong. */
export function animationProgramDurationMs(programInput: AnimationProgram): number {
  const program = normalizeAnimationProgram(programInput)
  return traversalFor(program).reduce((total, visit) => total + visitDuration(program, visit), 0)
}

function targetsFor(program: AnimationProgram, baseModel: FaceModel): FaceModel[] {
  return program.steps.map((step) => resolveFaceStateTarget(baseModel, step.target))
}

function visitStartOffsets(program: AnimationProgram, traversal: readonly Visit[]): number[] {
  const starts: number[] = []
  let cursor = 0
  for (const visit of traversal) {
    starts.push(cursor)
    cursor += visitDuration(program, visit)
  }
  return starts
}

function sourceModelForVisit(
  program: AnimationProgram,
  targets: readonly FaceModel[],
  traversal: readonly Visit[],
  cycleIndex: number,
  visitIndex: number,
  baseModel: FaceModel,
): FaceModel {
  if (cycleIndex === 0 && visitIndex === 0) return cloneFaceModel(baseModel)
  const previousVisit = visitIndex === 0 ? traversal.at(-1)! : traversal[visitIndex - 1]
  return cloneFaceModel(targets[previousVisit.stepIndex])
}

function collapsedZeroDurationSample(
  program: AnimationProgram,
  targets: readonly FaceModel[],
): Omit<SampledAnimationProgram, 'runtimeEvents'> {
  const stepIndex = program.playbackMode === 'once' ? program.steps.length - 1 : 0
  return {
    model: cloneFaceModel(targets[stepIndex]),
    programTimeMs: 0,
    cycleIndex: 0,
    stepIndex,
    stepId: program.steps[stepIndex].id,
    direction: 'forward',
    phase: 'complete',
    progress: 1,
  }
}

function visitInstancesForActions(
  program: AnimationProgram,
  traversal: readonly Visit[],
  starts: readonly number[],
  durationMs: number,
  sampleTimeMs: number,
): VisitInstance[] {
  if (durationMs === 0) return []
  const instances: VisitInstance[] = []
  if (program.playbackMode === 'once') {
    traversal.forEach((visit, visitIndex) => instances.push({
      ...visit,
      cycleIndex: 0,
      visitIndex,
      startTimeMs: starts[visitIndex],
    }))
    return instances
  }

  const currentCycle = Math.floor(sampleTimeMs / durationMs)
  for (let cycleIndex = Math.max(0, currentCycle - 1); cycleIndex <= currentCycle; cycleIndex += 1) {
    traversal.forEach((visit, visitIndex) => instances.push({
      ...visit,
      cycleIndex,
      visitIndex,
      startTimeMs: cycleIndex * durationMs + starts[visitIndex],
    }))
  }
  return instances
}

/**
 * Materialize explicit one-shot/control actions that can still affect this
 * sample. Repeating programs need only the current and previous cycle because
 * the same authored actions recur every cycle and deterministically dominate
 * older copies of themselves.
 */
export function animationProgramRuntimeEvents(
  programInput: AnimationProgram,
  timeMs: number,
): NormalizedRuntimeAnimationEvent[] {
  const program = normalizeAnimationProgram(programInput)
  const sampleTimeMs = nonNegativeFinite(timeMs, 'Animation program sample time')
  const traversal = traversalFor(program)
  const starts = visitStartOffsets(program, traversal)
  const durationMs = animationProgramDurationMs(program)
  const instances = visitInstancesForActions(program, traversal, starts, durationMs, sampleTimeMs)
  const materialized: RuntimeAnimationEvent[] = []

  for (const instance of instances) {
    const step = program.steps[instance.stepIndex]
    const holdStart = instance.startTimeMs + step.transitionDurationMs
    for (let actionIndex = 0; actionIndex < (step.actions?.length ?? 0); actionIndex += 1) {
      const action = step.actions![actionIndex]
      const startTimeMs = holdStart + (action.offsetMs ?? 0)
      if (startTimeMs > sampleTimeMs) continue
      materialized.push({
        id: `@program/${program.id}/${instance.cycleIndex}/${instance.visitIndex}/${action.id}`,
        channel: action.channel,
        action: action.action,
        startTimeMs,
        order: materialized.length,
        priority: action.priority ?? 0,
        ...(action.payload === undefined ? {} : { payload: structuredClone(action.payload) }),
      })
    }
  }
  return normalizeRuntimeAnimationEvents(materialized)
}

/** Sample the state portion of a program directly at an arbitrary timestamp. */
export function sampleAnimationProgram(
  programInput: AnimationProgram,
  baseModel: FaceModel,
  timeMs: number,
): SampledAnimationProgram {
  const program = normalizeAnimationProgram(programInput)
  const sampleTimeMs = nonNegativeFinite(timeMs, 'Animation program sample time')
  const traversal = traversalFor(program)
  const starts = visitStartOffsets(program, traversal)
  const durationMs = animationProgramDurationMs(program)
  const targets = targetsFor(program, baseModel)
  const runtimeEvents = animationProgramRuntimeEvents(program, sampleTimeMs)

  if (durationMs === 0) return { ...collapsedZeroDurationSample(program, targets), runtimeEvents }

  if (program.playbackMode === 'once' && sampleTimeMs >= durationMs) {
    const finalVisit = traversal.at(-1)!
    return {
      model: cloneFaceModel(targets[finalVisit.stepIndex]),
      programTimeMs: durationMs,
      cycleIndex: 0,
      stepIndex: finalVisit.stepIndex,
      stepId: program.steps[finalVisit.stepIndex].id,
      direction: finalVisit.direction,
      phase: 'complete',
      progress: 1,
      runtimeEvents,
    }
  }

  const cycleIndex = program.playbackMode === 'once' ? 0 : Math.floor(sampleTimeMs / durationMs)
  const localTimeMs = program.playbackMode === 'once' ? sampleTimeMs : sampleTimeMs % durationMs

  for (let visitIndex = 0; visitIndex < traversal.length; visitIndex += 1) {
    const visit = traversal[visitIndex]
    const step = program.steps[visit.stepIndex]
    const start = starts[visitIndex]
    const transitionEnd = start + step.transitionDurationMs
    const holdEnd = transitionEnd + step.holdDurationMs
    if (localTimeMs >= holdEnd && visitIndex < traversal.length - 1) continue

    const target = targets[visit.stepIndex]
    if (localTimeMs < transitionEnd && step.transitionDurationMs > 0) {
      const source = sourceModelForVisit(program, targets, traversal, cycleIndex, visitIndex, baseModel)
      const rawProgress = Math.max(0, Math.min(1, (localTimeMs - start) / step.transitionDurationMs))
      const progress = step.spring === undefined
        ? applyEasing(step.easing, rawProgress)
        : Math.min(1, Math.max(0, springResponse(step.spring, localTimeMs - start)))
      return {
        model: interpolateFaceModel(source, target, progress),
        programTimeMs: localTimeMs,
        cycleIndex,
        stepIndex: visit.stepIndex,
        stepId: step.id,
        direction: visit.direction,
        phase: 'transition',
        progress,
        runtimeEvents,
      }
    }

    return {
      model: cloneFaceModel(target),
      programTimeMs: localTimeMs,
      cycleIndex,
      stepIndex: visit.stepIndex,
      stepId: step.id,
      direction: visit.direction,
      phase: 'hold',
      progress: step.holdDurationMs === 0 ? 1 : Math.max(0, Math.min(1, (localTimeMs - transitionEnd) / step.holdDurationMs)),
      runtimeEvents,
    }
  }

  const finalVisit = traversal.at(-1)!
  return {
    model: cloneFaceModel(targets[finalVisit.stepIndex]),
    programTimeMs: localTimeMs,
    cycleIndex,
    stepIndex: finalVisit.stepIndex,
    stepId: program.steps[finalVisit.stepIndex].id,
    direction: finalVisit.direction,
    phase: 'hold',
    progress: 1,
    runtimeEvents,
  }
}
