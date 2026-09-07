import { describe, expect, it } from 'vitest'
import type { FaceModel } from '../core/model'
import { renderFaceToSvg } from '../renderers/svg'
import {
  ANIMATION_COMPOSITION_ORDER,
  advancePlaybackClock,
  createAnimationFrameContext,
  createPlaybackClock,
  evaluateAnimationFrame,
  normalizeAnimationDefinition,
  normalizeAnimationSeed,
  normalizeRuntimeAnimationEvents,
  pausePlaybackClock,
  playPlaybackClock,
  resolveDominantRuntimeEvent,
  runtimeEventsAtOrBefore,
  sampleRandomUnit,
  scheduledEventTimeMs,
  scheduledEventTimesThrough,
  seekPlaybackClock,
  setPlaybackRate,
  type AnimationChannelResolvers,
  type AnimationDefinition,
  type RuntimeAnimationEvent,
} from './index'

const baseModel: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: {
    geometry: {
      position: { x: 40, y: 32 },
      width: 36,
      height: 36,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  rightEye: {
    geometry: {
      position: { x: 88, y: 32 },
      width: 36,
      height: 36,
      cornerRadius: 8,
      rotation: 0,
    },
  },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#ffffff', stroke: '#ffffff', background: '#000000' },
}

const event = (
  id: string,
  overrides: Partial<RuntimeAnimationEvent> = {},
): RuntimeAnimationEvent => ({
  id,
  channel: 'eye-openness',
  action: 'blink',
  startTimeMs: 100,
  order: 0,
  ...overrides,
})

describe('animation frame context and seed', () => {
  it('requires explicit finite non-negative time and a uint32 seed', () => {
    expect(createAnimationFrameContext(16.6667, 0xffff_ffff)).toEqual({
      timeMs: 16.6667,
      seed: 0xffff_ffff,
    })
    expect(normalizeAnimationSeed(123)).toBe(123)
    expect(() => createAnimationFrameContext(-1, 0)).toThrow(RangeError)
    expect(() => createAnimationFrameContext(Number.NaN, 0)).toThrow(RangeError)
    expect(() => createAnimationFrameContext(0, 1.5)).toThrow(RangeError)
    expect(() => createAnimationFrameContext(0, 0x1_0000_0000)).toThrow(RangeError)
  })
})

describe('deterministic random streams and schedules', () => {
  it('repeats indexed samples and isolates unrelated named streams', () => {
    const seed = 0x1234abcd
    const blinkBefore = Array.from({ length: 8 }, (_, index) => sampleRandomUnit(seed, 'auto-blink', index))

    Array.from({ length: 20 }, (_, index) => sampleRandomUnit(seed, 'idle-gaze', index))

    const blinkAfter = Array.from({ length: 8 }, (_, index) => sampleRandomUnit(seed, 'auto-blink', index))
    const otherSeed = Array.from({ length: 8 }, (_, index) => sampleRandomUnit(seed + 1, 'auto-blink', index))

    expect(blinkAfter).toEqual(blinkBefore)
    expect(otherSeed).not.toEqual(blinkBefore)
  })

  it('samples interval schedules by event index rather than prior frame sampling', () => {
    const schedule = {
      stream: 'auto-blink',
      startTimeMs: 250,
      intervalMs: 1_000,
      variationMs: 500,
    }
    const seed = 42
    const forward = Array.from({ length: 6 }, (_, index) => scheduledEventTimeMs(schedule, seed, index))
    const reverse = Array.from({ length: 6 }, (_, offset) => scheduledEventTimeMs(schedule, seed, 5 - offset)).reverse()

    expect(reverse).toEqual(forward)
    expect(forward.every((time, index) => index === 0 || time > forward[index - 1])).toBe(true)
    expect(scheduledEventTimesThrough(schedule, seed, forward[3])).toEqual(forward.slice(0, 4))
  })
})

describe('runtime events', () => {
  it('uses a documented deterministic order and winner for conflicts/retriggers', () => {
    const events: RuntimeAnimationEvent[] = [
      event('priority-high', { priority: 2, order: 0 }),
      event('order-high', { priority: 0, order: 2 }),
      event('earlier', { startTimeMs: 90, priority: 99, order: 99 }),
      event('order-low', { priority: 0, order: 1 }),
      event('priority-low', { priority: -1, order: 9 }),
      event('gaze', { channel: 'gaze-pose', action: 'look', priority: 0, order: 0 }),
    ]

    expect(normalizeRuntimeAnimationEvents(events).map(({ id }) => id)).toEqual([
      'earlier',
      'gaze',
      'priority-low',
      'order-low',
      'order-high',
      'priority-high',
    ])
    expect(resolveDominantRuntimeEvent(events, 'eye-openness', 100)?.id).toBe('priority-high')
  })

  it('filters future events and rejects duplicate identities', () => {
    const events = [event('now'), event('future', { startTimeMs: 200, order: 1 })]
    expect(runtimeEventsAtOrBefore(events, 150).map(({ id }) => id)).toEqual(['now'])
    expect(() => normalizeRuntimeAnimationEvents([event('same'), event('same', { order: 1 })])).toThrow(
      /Duplicate runtime event id/,
    )
  })
})

describe('animation definition and composition', () => {
  it('keeps authored definitions JSON-safe and versioned', () => {
    const definition: AnimationDefinition = {
      version: 1,
      enabled: true,
      channels: {
        'gaze-pose': { target: [0.25, -0.5], easing: 'ease-in-out' },
      },
    }
    expect(normalizeAnimationDefinition(definition)).toEqual(definition)

    const invalid = {
      version: 1,
      enabled: true,
      channels: { 'gaze-pose': { value: Number.NaN } },
    } as unknown as AnimationDefinition
    expect(() => normalizeAnimationDefinition(invalid)).toThrow(/JSON-safe finite data/)
  })

  it('locks the Phase 3 composition order', () => {
    expect(ANIMATION_COMPOSITION_ORDER).toEqual([
      'base',
      'state-transition',
      'gaze-pose',
      'eye-openness',
      'motion-offset',
      'transient-effect',
    ])
  })

  it('executes channel resolvers in composition order independent of object insertion order', () => {
    const calls: string[] = []
    const resolvers: AnimationChannelResolvers = {
      'motion-offset': ({ model }) => {
        calls.push('motion-offset')
        return { ...model, gaze: { ...model.gaze, x: model.gaze.x * 2 } }
      },
      'state-transition': ({ model }) => {
        calls.push('state-transition')
        return { ...model, gaze: { ...model.gaze, x: 1 } }
      },
      'transient-effect': ({ model }) => {
        calls.push('transient-effect')
        return model
      },
      'eye-openness': ({ model }) => {
        calls.push('eye-openness')
        return { ...model, gaze: { ...model.gaze, x: model.gaze.x + 100 } }
      },
      'gaze-pose': ({ model }) => {
        calls.push('gaze-pose')
        return { ...model, gaze: { ...model.gaze, x: model.gaze.x * 10 } }
      },
    }
    const definition: AnimationDefinition = {
      version: 1,
      enabled: true,
      channels: {
        'state-transition': {},
        'gaze-pose': {},
        'eye-openness': {},
        'motion-offset': {},
        'transient-effect': {},
      },
    }

    const frame = evaluateAnimationFrame({
      baseModel,
      definition,
      context: createAnimationFrameContext(1_000, 7),
      channelResolvers: resolvers,
    })

    expect(calls).toEqual([
      'state-transition',
      'gaze-pose',
      'eye-openness',
      'motion-offset',
      'transient-effect',
    ])
    expect(frame.model.gaze.x).toBe(220)
  })

  it('allows explicit runtime events even when authored animation is disabled', () => {
    const calls: string[] = []
    const frame = evaluateAnimationFrame({
      baseModel,
      context: createAnimationFrameContext(100, 7),
      runtimeEvents: [event('manual-blink')],
      channelResolvers: {
        'eye-openness': ({ model, events }) => {
          calls.push(...events.map(({ id }) => id))
          return model
        },
      },
    })

    expect(calls).toEqual(['manual-blink'])
    expect(frame.runtimeEvents.map(({ id }) => id)).toEqual(['manual-blink'])
  })

  it('preserves static renderer output and does not mutate the caller model', () => {
    const before = renderFaceToSvg(baseModel)
    const frame = evaluateAnimationFrame({
      baseModel,
      context: createAnimationFrameContext(12_345.5, 99),
    })

    expect(frame.model).toEqual(baseModel)
    expect(frame.model).not.toBe(baseModel)
    expect(renderFaceToSvg(frame.model)).toBe(before)

    frame.model.gaze.x = 20
    frame.model.leftEye.geometry.position.x = 10
    expect(baseModel.gaze.x).toBe(0)
    expect(baseModel.leftEye.geometry.position.x).toBe(40)
  })
})

describe('playback clock', () => {
  it('makes incremental playback agree with direct seek at equivalent logical time', () => {
    let incremental = playPlaybackClock(createPlaybackClock())
    for (let index = 0; index < 4; index += 1) {
      incremental = advancePlaybackClock(incremental, 25)
    }
    const direct = seekPlaybackClock(createPlaybackClock(), 100)

    expect(incremental.positionMs).toBe(direct.positionMs)

    const paused = pausePlaybackClock(incremental)
    expect(advancePlaybackClock(paused, 500).positionMs).toBe(100)

    const doubleSpeed = playPlaybackClock(setPlaybackRate(createPlaybackClock(), 2))
    expect(advancePlaybackClock(doubleSpeed, 50).positionMs).toBe(100)
  })
})
