import { describe, expect, it } from 'vitest'
import {
  createAnimationFrameContext,
  createFaceTransition,
  evaluateAnimationFrame,
  eyeOpennessChannelResolver,
  normalizeRuntimeAnimationEvents,
  resolveGazeReactiveHeightScale,
  sampleFaceTransition,
  scheduledAutoBlinkEvents,
  scheduledIdleGazeTargets,
  stateTransitionChannelResolver,
  type AnimationDefinition,
  type JsonValue,
  type RuntimeAnimationEvent,
} from './index'
import {
  TEMPORAL_BASE,
  TEMPORAL_FRAME_RATES,
  TEMPORAL_SEED,
  temporalAutoBlinkDefinition,
  temporalExpression,
  temporalFrameSignature,
  temporalGeometryTransition,
  temporalIdleDefinition,
  temporalInvariantErrors,
  temporalPlaybackPositionAt,
  temporalRound,
  temporalRuntimeEvent,
} from './temporalRegressionSupport'

const compositeDefinition: AnimationDefinition = {
  version: 1,
  enabled: true,
  channels: {
    'state-transition': temporalGeometryTransition as unknown as JsonValue,
    'eye-openness': { kind: 'eye-openness' },
  },
}

const compositeEvents: RuntimeAnimationEvent[] = [
  temporalRuntimeEvent('manual-blink', 'eye-openness', 'blink', 240),
]

function compositeFrame(timeMs: number) {
  return evaluateAnimationFrame({
    baseModel: TEMPORAL_BASE,
    definition: compositeDefinition,
    context: createAnimationFrameContext(timeMs, TEMPORAL_SEED),
    runtimeEvents: compositeEvents,
    channelResolvers: {
      'state-transition': stateTransitionChannelResolver,
      'eye-openness': eyeOpennessChannelResolver,
    },
  }).model
}

describe('direct seek and sampling-order independence', () => {
  it('resolves the same transition + manual trigger frame regardless of timestamp sampling order', () => {
    const times = [0, 100, 180, 240, 320, 500, 640, 900, 1_200]
    const expected = new Map(times.map((timeMs) => [timeMs, temporalFrameSignature(compositeFrame(timeMs))]))

    for (const timeMs of [900, 240, 1_200, 100, 640, 0, 500, 320, 180]) {
      expect(temporalFrameSignature(compositeFrame(timeMs)), `${timeMs}ms`)
        .toEqual(expected.get(timeMs))
    }
  })

  it.each([350, 640, 1_200])('direct timestamp %dms agrees with incremental 20/25/30/60/120 Hz clocks', (timeMs) => {
    const direct = temporalFrameSignature(compositeFrame(timeMs))
    for (const frameRate of TEMPORAL_FRAME_RATES) {
      const positionMs = temporalPlaybackPositionAt(frameRate, timeMs)
      expect(positionMs, `${frameRate} Hz logical position`).toBeCloseTo(timeMs, 7)
      expect(temporalFrameSignature(compositeFrame(positionMs)), `${frameRate} Hz frame`).toEqual(direct)
    }
  })
})

describe('Curious threshold crossing', () => {
  it('keeps gaze-reactive eye deformation continuous and canvas-safe while horizontal gaze crosses its threshold', () => {
    const curiousBase = {
      ...TEMPORAL_BASE,
      expression: temporalExpression('expression:curious'),
    }
    const transition = createFaceTransition(
      'fixture:curious-threshold',
      { gaze: { x: 20, y: 0 } },
      0,
      1_000,
      'linear',
    )
    const frames = Array.from({ length: 41 }, (_, index) =>
      sampleFaceTransition(transition, curiousBase, index * 25),
    )
    const scales = frames.map((frame) =>
      resolveGazeReactiveHeightScale(frame.expression, 'right', frame.gaze.x, frame.canvas.width),
    )

    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].gaze.x).toBeGreaterThanOrEqual(frames[index - 1].gaze.x)
      expect(scales[index]).toBeGreaterThanOrEqual(scales[index - 1] - 1e-12)
      expect(temporalInvariantErrors(frames[index]), `frame ${index}`).toEqual([])
    }
    expect(scales.at(-1)).toBeGreaterThan(scales[0])
  })
})

describe('random substream and control-channel isolation', () => {
  it('does not perturb Auto-blink when unrelated Idle controls are sampled or toggled', () => {
    const baseline = scheduledAutoBlinkEvents(temporalAutoBlinkDefinition, [], 60_000, TEMPORAL_SEED)
    const idleControls = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('idle-off', 'gaze-pose', 'idle-gaze-disable', 10_000),
      temporalRuntimeEvent('idle-on', 'gaze-pose', 'idle-gaze-enable', 20_000, 1),
    ])

    scheduledIdleGazeTargets(temporalIdleDefinition, idleControls, TEMPORAL_BASE, 60_000, TEMPORAL_SEED)
    expect(scheduledAutoBlinkEvents(temporalAutoBlinkDefinition, idleControls, 60_000, TEMPORAL_SEED))
      .toEqual(baseline)
  })

  it('does not perturb Idle targets when unrelated Auto-blink controls are sampled or toggled', () => {
    const baseline = scheduledIdleGazeTargets(temporalIdleDefinition, [], TEMPORAL_BASE, 60_000, TEMPORAL_SEED)
    const blinkControls = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('blink-off', 'eye-openness', 'auto-blink-disable', 10_000),
      temporalRuntimeEvent('blink-on', 'eye-openness', 'auto-blink-enable', 20_000, 1),
    ])

    scheduledAutoBlinkEvents(temporalAutoBlinkDefinition, blinkControls, 60_000, TEMPORAL_SEED)
    expect(scheduledIdleGazeTargets(temporalIdleDefinition, blinkControls, TEMPORAL_BASE, 60_000, TEMPORAL_SEED))
      .toEqual(baseline)
  })
})

describe('long-running seeded schedule stability', () => {
  it('does not accumulate cadence-dependent Auto-blink or Idle drift over ten logical minutes', () => {
    const horizonMs = 10 * 60 * 1_000
    const directAuto = scheduledAutoBlinkEvents(temporalAutoBlinkDefinition, [], horizonMs, TEMPORAL_SEED)
      .map((event) => temporalRound(event.startTimeMs, 6))
    const directIdle = scheduledIdleGazeTargets(
      temporalIdleDefinition,
      [],
      TEMPORAL_BASE,
      horizonMs,
      TEMPORAL_SEED,
    ).map((entry) => [
      temporalRound(entry.startTimeMs, 6),
      temporalRound(entry.target.x, 6),
      temporalRound(entry.target.y, 6),
    ])

    expect(directAuto.length).toBeGreaterThan(300)
    expect(directIdle.length).toBeGreaterThan(300)

    for (const frameRate of TEMPORAL_FRAME_RATES) {
      const positionMs = temporalPlaybackPositionAt(frameRate, horizonMs)
      expect(positionMs, `${frameRate} Hz logical position`).toBeCloseTo(horizonMs, 6)

      const cadenceAuto = scheduledAutoBlinkEvents(
        temporalAutoBlinkDefinition,
        [],
        positionMs,
        TEMPORAL_SEED,
      ).map((event) => temporalRound(event.startTimeMs, 6))
      expect(cadenceAuto, `${frameRate} Hz Auto-blink`).toEqual(directAuto)

      const cadenceIdle = scheduledIdleGazeTargets(
        temporalIdleDefinition,
        [],
        TEMPORAL_BASE,
        positionMs,
        TEMPORAL_SEED,
      ).map((entry) => [
        temporalRound(entry.startTimeMs, 6),
        temporalRound(entry.target.x, 6),
        temporalRound(entry.target.y, 6),
      ])
      expect(cadenceIdle, `${frameRate} Hz Idle`).toEqual(directIdle)
    }
  })
})
