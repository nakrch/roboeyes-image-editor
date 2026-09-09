import { describe, expect, it } from 'vitest'
import { resolveEyeExpression } from '../core/model'
import { parsePreset, roboEyesPreset, serializePreset } from '../core/presets'
import {
  angryBehaviorProfile,
  animationProgramDurationMs,
  createAnimationFrameContext,
  curiousBehaviorProfile,
  evaluateBehaviorProfileFrame,
  happyBehaviorProfile,
  normalizeAnimationProgram,
  normalizePresetAnimationDefaults,
  sampleAnimationProgram,
  scaryBehaviorProfile,
} from './index'
import {
  TEMPORAL_BASE,
  TEMPORAL_FRAME_RATES,
  TEMPORAL_SEED,
  temporalExpression,
  temporalFrameSignature,
  temporalInvariantErrors,
  temporalPlaybackPositionAt,
  temporalSequenceProgram,
} from './temporalRegressionSupport'

describe('representative behavior-profile temporal composition', () => {
  const cases = [
    ['Happy', happyBehaviorProfile, 'expression:happy'],
    ['Tired / Scary-like', scaryBehaviorProfile, 'expression:tired'],
    ['Angry', angryBehaviorProfile, 'expression:angry'],
    ['Curious', curiousBehaviorProfile, 'expression:curious'],
  ] as const

  it('keeps profile sampling deterministic while leaving the static expression authored separately', () => {
    const signatures = cases.map(([name, profile, expressionId]) => {
      const staticExpression = structuredClone(temporalExpression(expressionId))
      const base = { ...TEMPORAL_BASE, expression: staticExpression }
      const first = evaluateBehaviorProfileFrame(profile, base, createAnimationFrameContext(1_750, TEMPORAL_SEED))
      const again = evaluateBehaviorProfileFrame(profile, base, createAnimationFrameContext(1_750, TEMPORAL_SEED))

      expect(temporalFrameSignature(again), name).toEqual(temporalFrameSignature(first))
      expect(first.expression, name).toEqual(staticExpression)
      expect(base.expression, name).toEqual(staticExpression)
      expect(temporalInvariantErrors(first), name).toEqual([])
      return temporalFrameSignature(first)
    })

    expect(new Set(signatures.map((signature) => JSON.stringify(signature))).size).toBe(cases.length)
  })

  it('samples scheduled Happy behavior identically regardless of timestamp ordering', () => {
    const base = { ...TEMPORAL_BASE, expression: temporalExpression('expression:happy') }
    const times = [0, 180, 420, 900, 1_750, 3_000, 5_000]
    const forward = times.map((timeMs) => temporalFrameSignature(
      evaluateBehaviorProfileFrame(happyBehaviorProfile, base, createAnimationFrameContext(timeMs, TEMPORAL_SEED)),
    ))
    const reverse = [...times].reverse().map((timeMs) => temporalFrameSignature(
      evaluateBehaviorProfileFrame(happyBehaviorProfile, base, createAnimationFrameContext(timeMs, TEMPORAL_SEED)),
    )).reverse()

    expect(reverse).toEqual(forward)
  })
})

describe('#112 state-sequence temporal boundaries', () => {
  it('locks once-mode transition/hold boundaries and duration', () => {
    expect(animationProgramDurationMs(temporalSequenceProgram)).toBe(650)
    const samples = [0, 100, 150, 200, 349, 350, 450, 550, 650]
      .map((timeMs) => sampleAnimationProgram(temporalSequenceProgram, TEMPORAL_BASE, timeMs))

    expect(samples.map((sample) => [sample.stepId, sample.phase])).toEqual([
      ['neutral', 'hold'],
      ['happy', 'transition'],
      ['happy', 'transition'],
      ['happy', 'hold'],
      ['happy', 'hold'],
      ['angry', 'transition'],
      ['angry', 'transition'],
      ['angry', 'hold'],
      [undefined, 'complete'],
    ])
    expect(samples[2].model.gaze.x).toBeCloseTo(0)
    expect(resolveEyeExpression(samples[2].model.expression, 'left').lowerLid).toBeCloseTo(0.14)
    expect(samples[6].model.gaze.x).toBeCloseTo(3)
  })

  it('keeps once/loop/ping-pong direct sampling independent of timestamp order', () => {
    for (const playbackMode of ['once', 'loop', 'ping-pong'] as const) {
      const program = { ...temporalSequenceProgram, id: `fixture:${playbackMode}`, playbackMode }
      const duration = animationProgramDurationMs(program)
      const times = [0, 50, 100, 150, 200, 350, Math.max(0, duration - 1), duration, duration + 150]
      const forward = times.map((timeMs) => temporalFrameSignature(sampleAnimationProgram(program, TEMPORAL_BASE, timeMs).model))
      const reverse = [...times].reverse()
        .map((timeMs) => temporalFrameSignature(sampleAnimationProgram(program, TEMPORAL_BASE, timeMs).model))
        .reverse()

      expect(reverse, playbackMode).toEqual(forward)
    }
  })

  it('keeps once/loop/ping-pong samples equivalent across 20/25/30/60/120 Hz clocks', () => {
    for (const playbackMode of ['once', 'loop', 'ping-pong'] as const) {
      const program = { ...temporalSequenceProgram, id: `fixture:fps:${playbackMode}`, playbackMode }
      const duration = animationProgramDurationMs(program)
      const times = [0, 150, 350, Math.max(0, duration - 1), duration, duration + 150]

      for (const frameRate of TEMPORAL_FRAME_RATES) {
        for (const timeMs of times) {
          const positionMs = temporalPlaybackPositionAt(frameRate, timeMs)
          expect(
            temporalFrameSignature(sampleAnimationProgram(program, TEMPORAL_BASE, positionMs).model),
            `${playbackMode} ${frameRate}Hz ${timeMs}ms`,
          ).toEqual(temporalFrameSignature(sampleAnimationProgram(program, TEMPORAL_BASE, timeMs).model))
        }
      }
    }
  })

  it('has no unintended discontinuity where authored holds enter transitions', () => {
    for (const playbackMode of ['once', 'loop', 'ping-pong'] as const) {
      const program = { ...temporalSequenceProgram, id: `fixture:continuity:${playbackMode}`, playbackMode }
      for (const boundary of [100, 350]) {
        const before = sampleAnimationProgram(program, TEMPORAL_BASE, boundary - 0.001).model
        const at = sampleAnimationProgram(program, TEMPORAL_BASE, boundary).model
        expect(Math.abs(before.gaze.x - at.gaze.x), `${playbackMode} @ ${boundary}ms x`).toBeLessThan(0.01)
        expect(Math.abs(before.gaze.y - at.gaze.y), `${playbackMode} @ ${boundary}ms y`).toBeLessThan(0.01)
      }
    }
  })
})

describe('versioned temporal data round trips', () => {
  it('preserves animation/program stable identities, timing, easing, actions, and seed through JSON', () => {
    const defaults = normalizePresetAnimationDefaults({
      version: 1,
      seed: TEMPORAL_SEED,
      behaviorProfile: happyBehaviorProfile,
      definition: {
        version: 1,
        enabled: true,
        channels: { 'eye-openness': { kind: 'eye-openness' } },
      },
      program: temporalSequenceProgram,
    })
    const roundTrip = normalizePresetAnimationDefaults(JSON.parse(JSON.stringify(defaults)))

    expect(roundTrip).toEqual(defaults)
    expect(roundTrip.version).toBe(1)
    if (roundTrip.version !== 1) throw new Error('Expected v1 animation defaults')
    expect(roundTrip.seed).toBe(TEMPORAL_SEED)
    expect(roundTrip.behaviorProfile?.id).toBe('behavior:happy')
    expect(roundTrip.program?.id).toBe('fixture:sequence')
    expect(roundTrip.program?.steps.map((step) => step.id)).toEqual(['neutral', 'happy', 'angry'])
    expect(roundTrip.program?.steps[1].actions?.[0].id).toBe('blink')
    expect(roundTrip.program?.steps[1].transitionDurationMs).toBe(100)
    expect(roundTrip.program?.steps[2].easing).toBe('ease-in-out')
    expect(normalizeAnimationProgram(JSON.parse(JSON.stringify(temporalSequenceProgram))))
      .toEqual(temporalSequenceProgram)
  })

  it('preserves temporal defaults and stable IDs through face-preset export/import', () => {
    const defaults = normalizePresetAnimationDefaults({
      version: 1,
      seed: TEMPORAL_SEED,
      behaviorProfile: curiousBehaviorProfile,
      program: temporalSequenceProgram,
    })
    const preset = {
      ...roboEyesPreset,
      id: 'custom:temporal-regression',
      name: 'Temporal regression',
      animationDefaults: defaults,
    }
    const parsed = parsePreset(serializePreset(preset))

    expect(parsed.animationDefaults).toEqual(defaults)
    expect(parsed.animationDefaults.version).toBe(1)
    if (parsed.animationDefaults.version !== 1) throw new Error('Expected v1 parsed animation defaults')
    expect(parsed.animationDefaults.program?.id).toBe('fixture:sequence')
    expect(parsed.animationDefaults.program?.steps[1].actions?.[0].id).toBe('blink')
  })
})
