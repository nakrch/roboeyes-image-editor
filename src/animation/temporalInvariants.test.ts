import { describe, expect, it } from 'vitest'
import { renderFaceToSvg } from '../renderers/svg'
import {
  createAnimationFrameContext,
  evaluateAnimationFrame,
  evaluateBehaviorProfileFrame,
  eyeOpennessChannelResolver,
  happyBehaviorProfile,
  idleGazeChannelResolver,
  motionOffsetChannelResolver,
  sampleAnimationProgram,
  sampleFaceTransition,
  type JsonValue,
} from './index'
import {
  TEMPORAL_BASE,
  TEMPORAL_SEED,
  temporalExpression,
  temporalGeometryTransition,
  temporalIdleDefinition,
  temporalInvariantErrors,
  temporalRuntimeEvent,
  temporalSequenceProgram,
} from './temporalRegressionSupport'

const SWEEP_SEEDS = [0, 1, 17, TEMPORAL_SEED, 0xffff_ffff] as const
const SWEEP_TIMES = Array.from({ length: 96 }, (_, index) => index * 53)

function expectValid(label: string, model: Parameters<typeof temporalInvariantErrors>[0]): void {
  expect(temporalInvariantErrors(model), label).toEqual([])
}

describe('temporal invariant sweeps', () => {
  it('keeps transition, Idle, eye-state events, one-shots, profile composition, and loop sequences valid', () => {
    const beforeBase = JSON.stringify(TEMPORAL_BASE)
    const beforeTransition = JSON.stringify(temporalGeometryTransition)
    const beforeProgram = JSON.stringify(temporalSequenceProgram)
    const motionEvents = [
      temporalRuntimeEvent('confused', 'motion-offset', 'confused', 200),
      temporalRuntimeEvent('laugh', 'motion-offset', 'laugh', 900, 1),
    ]
    const eyeEvents = [
      temporalRuntimeEvent('blink', 'eye-openness', 'blink', 300),
      temporalRuntimeEvent('wink-left', 'eye-openness', 'wink-left', 650, 1),
      temporalRuntimeEvent('close', 'eye-openness', 'close', 1_050, 2),
      temporalRuntimeEvent('open', 'eye-openness', 'open', 1_450, 3),
    ]
    const idleAnimation = {
      version: 1 as const,
      enabled: true,
      channels: { 'gaze-pose': temporalIdleDefinition as unknown as JsonValue },
    }
    const eyeAnimation = {
      version: 1 as const,
      enabled: true,
      channels: { 'eye-openness': { kind: 'eye-openness' } },
    }
    const loopProgram = { ...temporalSequenceProgram, id: 'fixture:sweep-loop', playbackMode: 'loop' as const }

    for (const seed of SWEEP_SEEDS) {
      for (const timeMs of SWEEP_TIMES) {
        expectValid(`transition seed=${seed} t=${timeMs}`, sampleFaceTransition(
          temporalGeometryTransition,
          TEMPORAL_BASE,
          timeMs,
        ))

        const idleFrame = evaluateAnimationFrame({
          baseModel: TEMPORAL_BASE,
          definition: idleAnimation,
          context: createAnimationFrameContext(timeMs, seed),
          channelResolvers: { 'gaze-pose': idleGazeChannelResolver },
        }).model
        expectValid(`idle seed=${seed} t=${timeMs}`, idleFrame)

        const eyeFrame = evaluateAnimationFrame({
          baseModel: TEMPORAL_BASE,
          definition: eyeAnimation,
          context: createAnimationFrameContext(timeMs, seed),
          runtimeEvents: eyeEvents,
          channelResolvers: { 'eye-openness': eyeOpennessChannelResolver },
        }).model
        expectValid(`eye events seed=${seed} t=${timeMs}`, eyeFrame)

        const motionFrame = evaluateAnimationFrame({
          baseModel: TEMPORAL_BASE,
          context: createAnimationFrameContext(timeMs, seed),
          runtimeEvents: motionEvents,
          channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
        }).model
        expectValid(`motion seed=${seed} t=${timeMs}`, motionFrame)

        const profileBase = {
          ...TEMPORAL_BASE,
          expression: temporalExpression('expression:happy'),
        }
        const profileFrame = evaluateBehaviorProfileFrame(
          happyBehaviorProfile,
          profileBase,
          createAnimationFrameContext(timeMs, seed),
        )
        expectValid(`profile seed=${seed} t=${timeMs}`, profileFrame)

        const sequenceFrame = sampleAnimationProgram(loopProgram, TEMPORAL_BASE, timeMs).model
        expectValid(`sequence seed=${seed} t=${timeMs}`, sequenceFrame)
      }
    }

    expect(JSON.stringify(TEMPORAL_BASE)).toBe(beforeBase)
    expect(JSON.stringify(temporalGeometryTransition)).toBe(beforeTransition)
    expect(JSON.stringify(temporalSequenceProgram)).toBe(beforeProgram)
  })

  it('removes temporary one-shot offsets exactly after completion', () => {
    const events = [temporalRuntimeEvent('confused', 'motion-offset', 'confused', 100)]
    const active = evaluateAnimationFrame({
      baseModel: TEMPORAL_BASE,
      context: createAnimationFrameContext(120, TEMPORAL_SEED),
      runtimeEvents: events,
      channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
    }).model
    const completed = evaluateAnimationFrame({
      baseModel: TEMPORAL_BASE,
      context: createAnimationFrameContext(600, TEMPORAL_SEED),
      runtimeEvents: events,
      channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
    }).model

    expect(active).not.toEqual(TEMPORAL_BASE)
    expect(completed).toEqual(TEMPORAL_BASE)
  })

  it('keeps Phase 1/2 static SVG output unchanged when animation is absent', () => {
    const before = renderFaceToSvg(TEMPORAL_BASE)
    for (const timeMs of [0, 1, 1_000, 123_456, 10 * 60 * 1_000]) {
      const frame = evaluateAnimationFrame({
        baseModel: TEMPORAL_BASE,
        context: createAnimationFrameContext(timeMs, TEMPORAL_SEED),
      }).model
      expect(renderFaceToSvg(frame), `${timeMs}ms`).toBe(before)
      expect(frame).toEqual(TEMPORAL_BASE)
    }
  })
})
