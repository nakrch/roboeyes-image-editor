import { describe, expect, it } from 'vitest'
import { expressionPresets, roboEyesPreset } from '../core/presets'
import { eyeOpennessChannelResolver } from './eyeOpenness'
import {
  advancePlaybackClock,
  createPlaybackClock,
  pausePlaybackClock,
  playPlaybackClock,
} from './clock'
import {
  animationProgramDurationMs,
  animationProgramRuntimeEvents,
  normalizeAnimationProgram,
  sampleAnimationProgram,
  type AnimationProgram,
} from './program'
import { createAnimationFrameContext, evaluateAnimationFrame } from './runtime'

function expression(id: string) {
  const preset = expressionPresets.find((entry) => entry.id === id)
  if (preset === undefined) throw new Error(`Missing expression ${id}`)
  return preset.expression
}

const expressionProgram: AnimationProgram = {
  version: 1,
  id: 'program:neutral-happy-neutral',
  name: 'Neutral Happy Neutral',
  playbackMode: 'once',
  steps: [
    {
      id: 'neutral-a',
      target: { expression: expression('expression:neutral') },
      transitionDurationMs: 0,
      easing: 'linear',
      holdDurationMs: 100,
    },
    {
      id: 'happy',
      target: { expression: expression('expression:happy') },
      transitionDurationMs: 100,
      easing: 'linear',
      holdDurationMs: 100,
    },
    {
      id: 'neutral-b',
      target: { expression: expression('expression:neutral') },
      transitionDurationMs: 100,
      easing: 'linear',
      holdDurationMs: 100,
    },
  ],
}

describe('program document and duration', () => {
  it('normalizes versioned plain data with stable identities', () => {
    const normalized = normalizeAnimationProgram(expressionProgram)
    expect(normalized.id).toBe('program:neutral-happy-neutral')
    expect(normalized.steps.map((step) => step.id)).toEqual(['neutral-a', 'happy', 'neutral-b'])
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)
    expect(animationProgramDurationMs(normalized)).toBe(500)
  })

  it('rejects duplicate step/action identities and actions outside the hold phase', () => {
    expect(() => normalizeAnimationProgram({
      ...expressionProgram,
      steps: [expressionProgram.steps[0], expressionProgram.steps[0]],
    })).toThrow(/step ids must be unique/)

    expect(() => normalizeAnimationProgram({
      version: 1,
      id: 'bad-action',
      playbackMode: 'once',
      steps: [{
        id: 'step', target: {}, transitionDurationMs: 0, easing: 'linear', holdDurationMs: 10,
        actions: [{ id: 'blink', channel: 'eye-openness', action: 'blink', offsetMs: 11 }],
      }],
    })).toThrow(/must not exceed/)
  })
})

describe('once sampling', () => {
  it('samples holds and entry transitions directly from arbitrary time', () => {
    const base = roboEyesPreset.model
    const at0 = sampleAnimationProgram(expressionProgram, base, 0)
    const at150 = sampleAnimationProgram(expressionProgram, base, 150)
    const at250 = sampleAnimationProgram(expressionProgram, base, 250)
    const at500 = sampleAnimationProgram(expressionProgram, base, 500)

    expect(at0.stepId).toBe('neutral-a')
    expect(at0.phase).toBe('hold')
    expect(at150.stepId).toBe('happy')
    expect(at150.phase).toBe('transition')
    expect(at150.model.expression.lowerLid).toBeCloseTo(0.14)
    expect(at250.stepId).toBe('happy')
    expect(at250.phase).toBe('hold')
    expect(at500.phase).toBe('complete')
    expect(at500.model.expression).toEqual(expression('expression:neutral'))
  })

  it('is independent of sampling order', () => {
    const times = [0, 50, 100, 150, 250, 350, 499, 500]
    const forward = times.map((time) => sampleAnimationProgram(expressionProgram, roboEyesPreset.model, time).model)
    const reverse = [...times].reverse().map((time) => sampleAnimationProgram(expressionProgram, roboEyesPreset.model, time).model).reverse()
    expect(reverse).toEqual(forward)
  })
})

describe('loop and ping-pong modes', () => {
  const gazeSteps = [
    { id: 'left', target: { gaze: { x: -10, y: 0 } }, transitionDurationMs: 0, easing: 'linear' as const, holdDurationMs: 100 },
    { id: 'center', target: { gaze: { x: 0, y: 0 } }, transitionDurationMs: 0, easing: 'linear' as const, holdDurationMs: 100 },
    { id: 'right', target: { gaze: { x: 10, y: 0 } }, transitionDurationMs: 0, easing: 'linear' as const, holdDurationMs: 100 },
  ]

  it('loops with deterministic cycle boundaries', () => {
    const program: AnimationProgram = { version: 1, id: 'loop', playbackMode: 'loop', steps: gazeSteps }
    expect(animationProgramDurationMs(program)).toBe(300)
    expect(sampleAnimationProgram(program, roboEyesPreset.model, 0).model.gaze.x).toBe(-10)
    expect(sampleAnimationProgram(program, roboEyesPreset.model, 100).model.gaze.x).toBe(0)
    expect(sampleAnimationProgram(program, roboEyesPreset.model, 200).model.gaze.x).toBe(10)
    const next = sampleAnimationProgram(program, roboEyesPreset.model, 300)
    expect(next.cycleIndex).toBe(1)
    expect(next.model.gaze.x).toBe(-10)
  })

  it('ping-pongs through the authored states without duplicating endpoints', () => {
    const program: AnimationProgram = { version: 1, id: 'ping', playbackMode: 'ping-pong', steps: gazeSteps }
    expect(animationProgramDurationMs(program)).toBe(400)
    expect([0, 100, 200, 300, 400, 500].map((time) =>
      sampleAnimationProgram(program, roboEyesPreset.model, time).model.gaze.x,
    )).toEqual([-10, 0, 10, 0, -10, 0])
    expect(sampleAnimationProgram(program, roboEyesPreset.model, 300).direction).toBe('reverse')
  })

  it('defines all-zero programs without modulo or replay ambiguity', () => {
    const zeroSteps = [
      { id: 'a', target: { gaze: { x: -5 } }, transitionDurationMs: 0, easing: 'linear' as const, holdDurationMs: 0 },
      { id: 'b', target: { gaze: { x: 5 } }, transitionDurationMs: 0, easing: 'linear' as const, holdDurationMs: 0 },
    ]
    const once: AnimationProgram = { version: 1, id: 'zero-once', playbackMode: 'once', steps: zeroSteps }
    const loop: AnimationProgram = { version: 1, id: 'zero-loop', playbackMode: 'loop', steps: zeroSteps }
    expect(sampleAnimationProgram(once, roboEyesPreset.model, 99_999).model.gaze.x).toBe(5)
    expect(sampleAnimationProgram(loop, roboEyesPreset.model, 99_999).model.gaze.x).toBe(-5)
  })
})

describe('generic step actions', () => {
  const blinkProgram: AnimationProgram = {
    version: 1,
    id: 'program:idle-blink-idle',
    playbackMode: 'once',
    steps: [
      { id: 'idle-a', target: {}, transitionDurationMs: 0, easing: 'linear', holdDurationMs: 100 },
      {
        id: 'blink', target: {}, transitionDurationMs: 0, easing: 'linear', holdDurationMs: 300,
        actions: [{ id: 'blink-now', channel: 'eye-openness', action: 'blink', offsetMs: 0 }],
      },
      { id: 'idle-b', target: {}, transitionDurationMs: 0, easing: 'linear', holdDurationMs: 100 },
    ],
  }

  it('expresses idle → blink → idle as generic runtime events', () => {
    expect(animationProgramRuntimeEvents(blinkProgram, 99)).toHaveLength(0)
    const events = animationProgramRuntimeEvents(blinkProgram, 180)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ channel: 'eye-openness', action: 'blink', startTimeMs: 100, priority: 0 })

    const state = sampleAnimationProgram(blinkProgram, roboEyesPreset.model, 180)
    const resolved = evaluateAnimationFrame({
      baseModel: state.model,
      context: createAnimationFrameContext(180, 1),
      runtimeEvents: state.runtimeEvents,
      channelResolvers: { 'eye-openness': eyeOpennessChannelResolver },
    }).model
    expect(resolved.leftEye.geometry.height).toBe(0)
    expect(resolved.rightEye.geometry.height).toBe(0)
  })

  it('repeating programs materialize current/previous-cycle actions without replaying every old cycle', () => {
    const loop = { ...blinkProgram, id: 'program:blink-loop', playbackMode: 'loop' as const }
    const events = animationProgramRuntimeEvents(loop, 10_180)
    expect(events.length).toBeLessThanOrEqual(2)
    expect(events.at(-1)?.startTimeMs).toBe(10_100)
  })
})

describe('playback state stays outside authored program data', () => {
  it('pause/resume advances an external clock without mutating the program', () => {
    const before = JSON.stringify(expressionProgram)
    let clock = createPlaybackClock(0)
    clock = playPlaybackClock(clock)
    clock = advancePlaybackClock(clock, 150)
    const paused = pausePlaybackClock(clock)
    const sample = sampleAnimationProgram(expressionProgram, roboEyesPreset.model, paused.positionMs)
    expect(sample.stepId).toBe('happy')
    expect(JSON.stringify(expressionProgram)).toBe(before)
  })
})
