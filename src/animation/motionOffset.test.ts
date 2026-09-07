import { describe, expect, it } from 'vitest'
import { isGazeCanvasSafe } from '../core/model'
import { roboEyesPreset } from '../core/presets'
import { renderFaceToSvg } from '../renderers/svg'
import {
  createAnimationFrameContext,
  evaluateAnimationFrame,
  normalizeRuntimeAnimationEvents,
  type RuntimeAnimationEvent,
} from './runtime'
import {
  applyMotionOffset,
  DEFAULT_CONFUSED_MOTION,
  DEFAULT_LAUGH_MOTION,
  motionOffsetChannelResolver,
  normalizeMotionPrimitiveDefinition,
  resolveMotionOffset,
  sampleMotionPrimitive,
} from './motionOffset'

function event(
  id: string,
  action: string,
  startTimeMs: number,
  order = 0,
  payload?: RuntimeAnimationEvent['payload'],
): RuntimeAnimationEvent {
  return {
    id,
    channel: 'motion-offset',
    action,
    startTimeMs,
    order,
    ...(payload === undefined ? {} : { payload }),
  }
}

function normalized(...events: RuntimeAnimationEvent[]) {
  return normalizeRuntimeAnimationEvents(events)
}

describe('motion primitive definition', () => {
  it('normalizes serializable generic axis/amplitude/timing/waveform parameters', () => {
    const definition = normalizeMotionPrimitiveDefinition({
      axis: 'y',
      amplitude: 7,
      durationMs: 600,
      periodMs: 80,
      phase: 1.25,
      waveform: 'triangle',
    })

    expect(definition).toEqual({
      axis: 'y',
      amplitude: 7,
      durationMs: 600,
      periodMs: 80,
      phase: 0.25,
      waveform: 'triangle',
    })
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition)
    expect(() => normalizeMotionPrimitiveDefinition({ axis: 'z' })).toThrow(/motion axis/)
    expect(() => normalizeMotionPrimitiveDefinition({ periodMs: 0 })).toThrow(/greater than zero/)
    expect(() => normalizeMotionPrimitiveDefinition({ waveform: 'noise' })).toThrow(/motion waveform/)
  })

  it('uses reference-compatible Confused and Laugh defaults', () => {
    expect(DEFAULT_CONFUSED_MOTION).toMatchObject({
      axis: 'x', amplitude: 20, durationMs: 500, periodMs: 40, waveform: 'square',
    })
    expect(DEFAULT_LAUGH_MOTION).toMatchObject({
      axis: 'y', amplitude: 5, durationMs: 500, periodMs: 40, waveform: 'square',
    })
  })
})

describe('explicit-time waveform sampling', () => {
  it('samples horizontal square flicker from logical time rather than frame count', () => {
    const definition = normalizeMotionPrimitiveDefinition({
      axis: 'x', amplitude: 10, durationMs: 100, periodMs: 40, waveform: 'square',
    })

    expect(sampleMotionPrimitive(definition, 100, 99)).toEqual({ x: 0, y: 0, active: false })
    expect(sampleMotionPrimitive(definition, 100, 100)).toEqual({ x: -10, y: 0, active: true })
    expect(sampleMotionPrimitive(definition, 100, 119)).toEqual({ x: -10, y: 0, active: true })
    expect(sampleMotionPrimitive(definition, 100, 120)).toEqual({ x: 10, y: 0, active: true })
    expect(sampleMotionPrimitive(definition, 100, 140)).toEqual({ x: -10, y: 0, active: true })
    expect(sampleMotionPrimitive(definition, 100, 200)).toEqual({ x: 0, y: 0, active: false })
  })

  it('supports sine/triangle and deterministic seeded jitter', () => {
    const sine = normalizeMotionPrimitiveDefinition({
      axis: 'y', amplitude: 4, durationMs: 200, periodMs: 100, waveform: 'sine',
    })
    expect(sampleMotionPrimitive(sine, 0, 25).y).toBeCloseTo(4)
    expect(sampleMotionPrimitive(sine, 0, 75).y).toBeCloseTo(-4)

    const triangle = normalizeMotionPrimitiveDefinition({
      axis: 'x', amplitude: 8, durationMs: 200, periodMs: 100, waveform: 'triangle',
    })
    expect(sampleMotionPrimitive(triangle, 0, 0).x).toBeCloseTo(-8)
    expect(sampleMotionPrimitive(triangle, 0, 50).x).toBeCloseTo(8)

    const jitter = normalizeMotionPrimitiveDefinition({
      axis: 'x', amplitude: 6, durationMs: 300, periodMs: 50, waveform: 'jitter',
    })
    const first = [10, 60, 110].map((time) => sampleMotionPrimitive(jitter, 0, time, 17, 'jitter-test').x)
    const reverse = [110, 60, 10].map((time) => sampleMotionPrimitive(jitter, 0, time, 17, 'jitter-test').x).reverse()
    expect(reverse).toEqual(first)
    expect(first.every((value) => Math.abs(value) <= 6)).toBe(true)
  })
})

describe('Confused/Laugh one-shots', () => {
  it('builds Confused as a bounded horizontal generic primitive', () => {
    const events = normalized(event('confused-1', 'confused', 100))
    expect(resolveMotionOffset(events, 100, 1)).toMatchObject({ x: -20, y: 0, active: true })
    expect(resolveMotionOffset(events, 120, 1)).toMatchObject({ x: 20, y: 0, active: true })
    expect(resolveMotionOffset(events, 599, 1).active).toBe(true)
    expect(resolveMotionOffset(events, 600, 1)).toMatchObject({ x: 0, y: 0, active: false })
  })

  it('builds Laugh as a bounded vertical generic primitive', () => {
    const events = normalized(event('laugh-1', 'laugh', 0))
    expect(resolveMotionOffset(events, 0, 1)).toMatchObject({ x: 0, y: -5, active: true })
    expect(resolveMotionOffset(events, 20, 1)).toMatchObject({ x: 0, y: 5, active: true })
    expect(resolveMotionOffset(events, 500, 1)).toMatchObject({ x: 0, y: 0, active: false })
  })

  it('allows generic payload overrides without creating renderer-specific behavior', () => {
    const events = normalized(event('custom', 'motion', 0, 0, {
      axis: 'y', amplitude: 3, durationMs: 100, periodMs: 20, waveform: 'square', phase: 0.5,
    }))
    expect(resolveMotionOffset(events, 0, 1)).toMatchObject({ x: 0, y: 3, active: true })
  })
})

describe('retrigger and stop semantics', () => {
  it('retrigger replaces the active motion and restarts phase from the retrigger timestamp', () => {
    const events = normalized(
      event('first', 'confused', 0, 0),
      event('second', 'laugh', 110, 1),
    )

    expect(resolveMotionOffset(events, 109, 1)).toMatchObject({ x: 20, y: 0, active: true })
    expect(resolveMotionOffset(events, 110, 1)).toMatchObject({ x: 0, y: -5, active: true, sourceEventId: 'second' })
    expect(resolveMotionOffset(events, 130, 1)).toMatchObject({ x: 0, y: 5, active: true })
  })

  it('stop clears the offset immediately and completed motion does not resume', () => {
    const events = normalized(
      event('first', 'confused', 0, 0),
      event('stop', 'motion-stop', 100, 1),
    )
    expect(resolveMotionOffset(events, 99, 1).active).toBe(true)
    expect(resolveMotionOffset(events, 100, 1)).toMatchObject({ x: 0, y: 0, active: false })
    expect(resolveMotionOffset(events, 400, 1)).toMatchObject({ x: 0, y: 0, active: false })
  })
})

describe('FaceModel composition', () => {
  it('composes on top of gaze/pose without mutating authored gaze and restores base exactly after completion', () => {
    const base = {
      ...roboEyesPreset.model,
      gaze: { x: 4, y: -2 },
    }
    const events = normalized(event('laugh', 'laugh', 0))
    const active = applyMotionOffset(base, resolveMotionOffset(events, 20, 7))

    expect(active.gaze).toEqual(base.gaze)
    expect(active.leftEye.geometry.position.y).not.toBe(base.leftEye.geometry.position.y)
    expect(active.rightEye.geometry.position.y).not.toBe(base.rightEye.geometry.position.y)

    const ended = applyMotionOffset(base, resolveMotionOffset(events, 500, 7))
    expect(ended).toEqual(base)
    expect(renderFaceToSvg(ended)).toBe(renderFaceToSvg(base))
  })

  it('clamps large offsets to canvas-safe visual displacement', () => {
    const base = roboEyesPreset.model
    const moved = applyMotionOffset(base, { x: 10_000, y: -10_000 })
    expect(isGazeCanvasSafe({
      ...moved,
      gaze: {
        x: base.gaze.x + (moved.leftEye.geometry.position.x - base.leftEye.geometry.position.x),
        y: base.gaze.y + (moved.leftEye.geometry.position.y - base.leftEye.geometry.position.y),
      },
      leftEye: base.leftEye,
      rightEye: base.rightEye,
    })).toBe(true)
  })

  it('integrates through the #98 motion-offset channel in explicit composition order', () => {
    const runtimeEvent = event('confused', 'confused', 100)
    const sample = (timeMs: number) => evaluateAnimationFrame({
      baseModel: roboEyesPreset.model,
      context: createAnimationFrameContext(timeMs, 42),
      runtimeEvents: [runtimeEvent],
      channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
    }).model

    const start = sample(100)
    expect(start.gaze).toEqual(roboEyesPreset.model.gaze)
    expect(start.leftEye.geometry.position.x).not.toBe(roboEyesPreset.model.leftEye.geometry.position.x)
    expect(sample(600)).toEqual(roboEyesPreset.model)
    expect(sample(120)).toEqual(sample(120))
  })
})
