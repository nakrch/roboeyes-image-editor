import { describe, expect, it } from 'vitest'
import {
  areEyeLidAperturesValid,
  canFitEyesInCanvas,
  isGazeCanvasSafe,
  resolveEyeExpression,
  resolveGazeReactiveHeightScale,
  type FaceModel,
} from '../core/model'
import {
  expressionPresets,
  parsePreset,
  roboEyesPreset,
  serializePreset,
} from '../core/presets'
import { renderFaceToSvg } from '../renderers/svg'
import {
  advancePlaybackClock,
  angryBehaviorProfile,
  animationProgramDurationMs,
  createAnimationFrameContext,
  createFaceTransition,
  createPlaybackClock,
  curiousBehaviorProfile,
  eyeOpennessChannelResolver,
  eyeSpacing,
  evaluateAnimationFrame,
  evaluateBehaviorProfileFrame,
  happyBehaviorProfile,
  idleGazeChannelResolver,
  motionOffsetChannelResolver,
  normalizeAnimationProgram,
  normalizeEyeOpennessDefinition,
  normalizeIdleGazeDefinition,
  normalizePresetAnimationDefaults,
  normalizeRuntimeAnimationEvents,
  playPlaybackClock,
  resolveEyeOpenness,
  resolveGazeReactiveHeightScale as _unusedResolveGazeReactiveHeightScale,
  resolveMotionOffset,
  sampleAnimationProgram,
  sampleFaceTransition,
  scaryBehaviorProfile,
  scheduledAutoBlinkEvents,
  scheduledIdleGazeTargets,
  stateTransitionChannelResolver,
  type AnimationDefinition,
  type AnimationProgram,
  type JsonValue,
  type RuntimeAnimationEvent,
} from './index'

void _unusedResolveGazeReactiveHeightScale

const BASE = roboEyesPreset.model
const SEED = 0x1234abcd
const FRAME_RATES = [20, 25, 30, 60, 120] as const
const EXPRESSION_KEYS = [
  'upperLid',
  'upperLidInner',
  'upperLidOuter',
  'lowerLid',
  'lowerLidCurvature',
  'tilt',
  'heightScale',
  'gazeHeightExpansion',
  'gazeHeightThreshold',
] as const

function expression(id: string) {
  const preset = expressionPresets.find((entry) => entry.id === id)
  if (preset === undefined) throw new Error(`Missing expression preset ${id}`)
  return preset.expression
}

function round(value: number, digits = 9): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function resolvedExpressionSignature(model: FaceModel, side: 'left' | 'right') {
  const resolved = resolveEyeExpression(model.expression, side)
  return EXPRESSION_KEYS.map((key) => round(resolved[key]))
}

function frameSignature(model: FaceModel) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  return {
    canvas: [round(model.canvas.width), round(model.canvas.height)],
    left: [
      round(left.position.x), round(left.position.y), round(left.width), round(left.height),
      round(left.cornerRadius), round(left.rotation),
    ],
    right: [
      round(right.position.x), round(right.position.y), round(right.width), round(right.height),
      round(right.cornerRadius), round(right.rotation),
    ],
    spacing: round(eyeSpacing(model)),
    gaze: [round(model.gaze.x), round(model.gaze.y)],
    expression: {
      left: resolvedExpressionSignature(model, 'left'),
      right: resolvedExpressionSignature(model, 'right'),
    },
  }
}

function transitionFixtureSignature(model: FaceModel) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const leftExpression = resolveEyeExpression(model.expression, 'left')
  const rightExpression = resolveEyeExpression(model.expression, 'right')
  return [
    round(left.position.x), round(right.position.x),
    round(left.width), round(right.width),
    round(left.height), round(right.height),
    round(left.cornerRadius), round(right.cornerRadius),
    round(left.rotation), round(right.rotation),
    round(eyeSpacing(model)), round(model.gaze.x), round(model.gaze.y),
    round(leftExpression.lowerLid), round(leftExpression.lowerLidCurvature),
    round(rightExpression.lowerLid), round(rightExpression.lowerLidCurvature),
  ]
}

function allNumericValues(value: unknown, output: number[] = []): number[] {
  if (typeof value === 'number') output.push(value)
  else if (Array.isArray(value)) value.forEach((entry) => allNumericValues(entry, output))
  else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((entry) => allNumericValues(entry, output))
  }
  return output
}

function assertFrameInvariants(model: FaceModel): void {
  expect(allNumericValues(model).every(Number.isFinite)).toBe(true)
  expect(model.canvas.width).toBeGreaterThanOrEqual(0)
  expect(model.canvas.height).toBeGreaterThanOrEqual(0)
  for (const eye of [model.leftEye, model.rightEye]) {
    expect(eye.geometry.width).toBeGreaterThanOrEqual(0)
    expect(eye.geometry.height).toBeGreaterThanOrEqual(0)
    expect(eye.geometry.cornerRadius).toBeGreaterThanOrEqual(0)
  }
  expect(resolveEyeExpression(model.expression, 'left').heightScale).toBeGreaterThanOrEqual(0)
  expect(resolveEyeExpression(model.expression, 'right').heightScale).toBeGreaterThanOrEqual(0)
  expect(areEyeLidAperturesValid(model.expression)).toBe(true)
  expect(canFitEyesInCanvas(model)).toBe(true)
  expect(isGazeCanvasSafe(model)).toBe(true)
}

function runtimeEvent(
  id: string,
  channel: RuntimeAnimationEvent['channel'],
  action: string,
  startTimeMs: number,
  order = 0,
  priority = 0,
): RuntimeAnimationEvent {
  return { id, channel, action, startTimeMs, order, priority }
}

function playbackPositionAt(frameRate: number, durationMs: number): number {
  const frameDurationMs = 1_000 / frameRate
  const wholeFrames = Math.floor(durationMs / frameDurationMs)
  let clock = playPlaybackClock(createPlaybackClock())
  for (let frame = 0; frame < wholeFrames; frame += 1) {
    clock = advancePlaybackClock(clock, frameDurationMs)
  }
  const remainderMs = durationMs - wholeFrames * frameDurationMs
  if (remainderMs > 1e-9) clock = advancePlaybackClock(clock, remainderMs)
  return clock.positionMs
}

const geometryTransition = createFaceTransition(
  'fixture:geometry-expression',
  {
    gaze: { x: 8, y: -4 },
    leftEye: { geometry: { width: 30, height: 28, cornerRadius: 6, rotation: -10 } },
    rightEye: { geometry: { width: 42, height: 32, cornerRadius: 10, rotation: 10 } },
    eyeSpacing: 18,
    expression: expression('expression:happy'),
  },
  100,
  800,
  'linear',
)

const autoBlinkDefinition = {
  enabled: true,
  startTimeMs: 0,
  intervalMs: 1_000,
  variationMs: 500,
}

const idleDefinition = normalizeIdleGazeDefinition({
  kind: 'idle-gaze',
  enabled: true,
  intervalMs: 1_000,
  variationMs: 700,
  transitionDurationMs: 300,
  easing: 'ease-in-out',
  xRange: { min: -10, max: 10 },
  yRange: { min: -5, max: 5 },
})

const sequenceProgram: AnimationProgram = {
  version: 1,
  id: 'fixture:sequence',
  playbackMode: 'once',
  steps: [
    {
      id: 'neutral',
      target: { expression: expression('expression:neutral'), gaze: { x: -6, y: 0 } },
      transitionDurationMs: 0,
      easing: 'linear',
      holdDurationMs: 100,
    },
    {
      id: 'happy',
      target: { expression: expression('expression:happy'), gaze: { x: 6, y: 0 } },
      transitionDurationMs: 100,
      easing: 'linear',
      holdDurationMs: 150,
      actions: [{ id: 'blink', channel: 'eye-openness', action: 'blink', offsetMs: 50 }],
    },
    {
      id: 'angry',
      target: { expression: expression('expression:angry'), gaze: { x: 0, y: 0 } },
      transitionDurationMs: 200,
      easing: 'ease-in-out',
      holdDurationMs: 100,
    },
  ],
}

describe('temporal exact fixtures', () => {
  it('locks transition geometry, spacing, gaze, radius, rotation, and expression at start/mid/end', () => {
    expect([100, 500, 900].map((timeMs) =>
      transitionFixtureSignature(sampleFaceTransition(geometryTransition, BASE, timeMs)),
    )).toEqual([
      [40, 88, 36, 36, 36, 36, 8, 8, 0, 0, 12, 0, 0, 0, 0, 0, 0],
      [38.5, 89.5, 33, 39, 32, 34, 7, 9, -5, 5, 15, 4, -2, 0.14, 0.22, 0.14, 0.22],
      [37, 91, 30, 42, 28, 32, 6, 10, -10, 10, 18, 8, -4, 0.28, 0.44, 0.28, 0.44],
    ])
  })

  it('locks blink, independent wink, persistent close/sleep, reopen, and conflict priority timing', () => {
    const eyeDefinition = normalizeEyeOpennessDefinition({ kind: 'eye-openness' })
    const blink = normalizeRuntimeAnimationEvents([
      runtimeEvent('blink', 'eye-openness', 'blink', 100),
    ])
    expect([100, 180, 200, 260, 320].map((timeMs) => {
      const resolved = resolveEyeOpenness(eyeDefinition, blink, timeMs)
      return [round(resolved.left), round(resolved.right)]
    })).toEqual([[1, 1], [0, 0], [0, 0], [0.5, 0.5], [1, 1]])

    const leftWink = normalizeRuntimeAnimationEvents([runtimeEvent('left', 'eye-openness', 'wink-left', 0)])
    const rightWink = normalizeRuntimeAnimationEvents([runtimeEvent('right', 'eye-openness', 'wink-right', 0)])
    expect(resolveEyeOpenness(eyeDefinition, leftWink, 80)).toMatchObject({ left: 0, right: 1 })
    expect(resolveEyeOpenness(eyeDefinition, rightWink, 80)).toMatchObject({ left: 1, right: 0 })

    const persistent = normalizeRuntimeAnimationEvents([
      runtimeEvent('sleep', 'eye-openness', 'sleep', 0, 0),
      runtimeEvent('open', 'eye-openness', 'open', 1_000, 1),
    ])
    expect(resolveEyeOpenness(eyeDefinition, persistent, 900)).toMatchObject({ left: 0, right: 0, state: 'sleep' })
    expect(resolveEyeOpenness(eyeDefinition, persistent, 1_120)).toMatchObject({ left: 1, right: 1, state: 'open' })

    const conflict = normalizeRuntimeAnimationEvents([
      runtimeEvent('close', 'eye-openness', 'close', 100, 0, 0),
      runtimeEvent('open', 'eye-openness', 'open', 100, 0, 10),
    ])
    expect(resolveEyeOpenness(eyeDefinition, conflict, 300)).toMatchObject({ left: 1, right: 1, state: 'open' })
  })

  it('locks horizontal/vertical one-shot phase samples and completion', () => {
    const confused = normalizeRuntimeAnimationEvents([runtimeEvent('confused', 'motion-offset', 'confused', 100)])
    expect([100, 120, 140, 599, 600].map((timeMs) => {
      const resolved = resolveMotionOffset(confused, timeMs, SEED)
      return [round(resolved.x), round(resolved.y), resolved.active]
    })).toEqual([
      [-20, 0, true], [20, 0, true], [-20, 0, true], [20, 0, true], [0, 0, false],
    ])

    const laugh = normalizeRuntimeAnimationEvents([runtimeEvent('laugh', 'motion-offset', 'laugh', 0)])
    expect([0, 20, 40, 499, 500].map((timeMs) => {
      const resolved = resolveMotionOffset(laugh, timeMs, SEED)
      return [round(resolved.x), round(resolved.y), resolved.active]
    })).toEqual([
      [0, -5, true], [0, 5, true], [0, -5, true], [0, -5, true], [0, 0, false],
    ])
  })

  it('locks a fixed-seed auto-blink schedule with variation', () => {
    const times = scheduledAutoBlinkEvents(autoBlinkDefinition, [], 10_000, SEED)
      .map((event) => round(event.startTimeMs, 6))
    expect(times).toEqual([
      1059.583942,
      2417.90204,
      3632.111399,
      5049.396435,
      6262.147765,
      7428.117122,
      8597.67571,
      9956.274493,
    ])
  })

  it('locks fixed-seed idle target times and coordinates with variation', () => {
    const targets = scheduledIdleGazeTargets(idleDefinition, [], BASE, 6_000, SEED)
      .map((entry) => [
        entry.targetIndex,
        round(entry.startTimeMs, 6),
        round(entry.target.x, 6),
        round(entry.target.y, 6),
      ])
    expect(targets).toEqual([
      [0, 0, -9.099961, -2.882891],
      [1, 1639.696714, 9.963554, 2.21712],
      [2, 2895.368171, -2.475201, -3.881411],
      [3, 4382.115692, -8.29772, 0.153061],
      [4, 5441.076553, -6.668947, -0.075316],
    ])
  })
})

describe('direct seek, order independence, and frame-rate equivalence', () => {
  const transitionDefinition: AnimationDefinition = {
    version: 1,
    enabled: true,
    channels: {
      'state-transition': geometryTransition as unknown as JsonValue,
      'eye-openness': { kind: 'eye-openness' },
    },
  }
  const events: RuntimeAnimationEvent[] = [runtimeEvent('manual-blink', 'eye-openness', 'blink', 240)]
  const sample = (timeMs: number) => evaluateAnimationFrame({
    baseModel: BASE,
    definition: transitionDefinition,
    context: createAnimationFrameContext(timeMs, SEED),
    runtimeEvents: events,
    channelResolvers: {
      'state-transition': stateTransitionChannelResolver,
      'eye-openness': eyeOpennessChannelResolver,
    },
  }).model

  it('is independent of arbitrary sampling order', () => {
    const times = [0, 100, 180, 240, 320, 500, 640, 900, 1_200]
    const expected = new Map(times.map((timeMs) => [timeMs, frameSignature(sample(timeMs))]))
    for (const timeMs of [900, 240, 1_200, 100, 640, 0, 500, 320, 180]) {
      expect(frameSignature(sample(timeMs))).toEqual(expected.get(timeMs))
    }
  })

  it.each([350, 640, 1_200])('direct timestamp %dms agrees across 20/25/30/60/120 Hz playback', (timeMs) => {
    const direct = frameSignature(sample(timeMs))
    for (const frameRate of FRAME_RATES) {
      const positionMs = playbackPositionAt(frameRate, timeMs)
      expect(positionMs).toBeCloseTo(timeMs, 8)
      expect(frameSignature(sample(positionMs)), `${frameRate} Hz`).toEqual(direct)
    }
  })

  it('keeps Curious gaze-reactive deformation continuous while crossing thresholds', () => {
    const curiousBase: FaceModel = { ...BASE, expression: expression('expression:curious') }
    const transition = createFaceTransition(
      'fixture:curious-threshold',
      { gaze: { x: 20, y: 0 } },
      0,
      1_000,
      'linear',
    )
    const frames = Array.from({ length: 21 }, (_, index) =>
      sampleFaceTransition(transition, curiousBase, index * 50),
    )
    const scales = frames.map((frame) =>
      resolveGazeReactiveHeightScale(frame.expression, 'right', frame.gaze.x, frame.canvas.width),
    )
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].gaze.x).toBeGreaterThanOrEqual(frames[index - 1].gaze.x)
      expect(scales[index]).toBeGreaterThanOrEqual(scales[index - 1] - 1e-12)
      assertFrameInvariants(frames[index])
    }
  })
})

describe('seeded schedule isolation and long-running cadence stability', () => {
  it('keeps Auto-blink and Idle on isolated random/control substreams', () => {
    const baselineAuto = scheduledAutoBlinkEvents(autoBlinkDefinition, [], 60_000, SEED)
    const idleControls = normalizeRuntimeAnimationEvents([
      runtimeEvent('idle-off', 'gaze-pose', 'idle-gaze-disable', 10_000),
      runtimeEvent('idle-on', 'gaze-pose', 'idle-gaze-enable', 20_000, 1),
    ])
    scheduledIdleGazeTargets(idleDefinition, idleControls, BASE, 60_000, SEED)
    expect(scheduledAutoBlinkEvents(autoBlinkDefinition, idleControls, 60_000, SEED)).toEqual(baselineAuto)

    const baselineIdle = scheduledIdleGazeTargets(idleDefinition, [], BASE, 60_000, SEED)
    const blinkControls = normalizeRuntimeAnimationEvents([
      runtimeEvent('blink-off', 'eye-openness', 'auto-blink-disable', 10_000),
      runtimeEvent('blink-on', 'eye-openness', 'auto-blink-enable', 20_000, 1),
    ])
    scheduledAutoBlinkEvents(autoBlinkDefinition, blinkControls, 60_000, SEED)
    expect(scheduledIdleGazeTargets(idleDefinition, blinkControls, BASE, 60_000, SEED)).toEqual(baselineIdle)
  })

  it('does not accumulate cadence-dependent drift over ten logical minutes', () => {
    const horizonMs = 10 * 60 * 1_000
    const directAuto = scheduledAutoBlinkEvents(autoBlinkDefinition, [], horizonMs, SEED)
      .map((event) => round(event.startTimeMs, 6))
    const directIdle = scheduledIdleGazeTargets(idleDefinition, [], BASE, horizonMs, SEED)
      .map((entry) => [round(entry.startTimeMs, 6), round(entry.target.x, 6), round(entry.target.y, 6)])

    for (const frameRate of FRAME_RATES) {
      const positionMs = playbackPositionAt(frameRate, horizonMs)
      expect(positionMs).toBeCloseTo(horizonMs, 6)
      expect(scheduledAutoBlinkEvents(autoBlinkDefinition, [], positionMs, SEED)
        .map((event) => round(event.startTimeMs, 6)), `${frameRate} Hz auto-blink`).toEqual(directAuto)
      expect(scheduledIdleGazeTargets(idleDefinition, [], BASE, positionMs, SEED)
        .map((entry) => [round(entry.startTimeMs, 6), round(entry.target.x, 6), round(entry.target.y, 6)]), `${frameRate} Hz idle`).toEqual(directIdle)
    }
  })
})

describe('behavior-profile temporal composition', () => {
  const cases = [
    ['Happy', happyBehaviorProfile, 'expression:happy'],
    ['Tired / Scary-like', scaryBehaviorProfile, 'expression:tired'],
    ['Angry', angryBehaviorProfile, 'expression:angry'],
    ['Curious', curiousBehaviorProfile, 'expression:curious'],
  ] as const

  it('keeps representative profile composition deterministic without replacing static expression data', () => {
    const signatures = cases.map(([name, profile, expressionId]) => {
      const staticExpression = structuredClone(expression(expressionId))
      const base: FaceModel = { ...BASE, expression: staticExpression }
      const first = evaluateBehaviorProfileFrame(profile, base, createAnimationFrameContext(1_750, SEED))
      const again = evaluateBehaviorProfileFrame(profile, base, createAnimationFrameContext(1_750, SEED))
      expect(frameSignature(again), name).toEqual(frameSignature(first))
      expect(first.expression, name).toEqual(staticExpression)
      expect(base.expression, name).toEqual(staticExpression)
      assertFrameInvariants(first)
      return frameSignature(first)
    })
    expect(new Set(signatures.map((entry) => JSON.stringify(entry))).size).toBe(cases.length)
  })

  it('remains deterministic across timestamp ordering for scheduled profiles', () => {
    const base: FaceModel = { ...BASE, expression: expression('expression:happy') }
    const times = [0, 180, 420, 900, 1_750, 3_000, 5_000]
    const forward = times.map((timeMs) => frameSignature(
      evaluateBehaviorProfileFrame(happyBehaviorProfile, base, createAnimationFrameContext(timeMs, SEED)),
    ))
    const reverse = [...times].reverse().map((timeMs) => frameSignature(
      evaluateBehaviorProfileFrame(happyBehaviorProfile, base, createAnimationFrameContext(timeMs, SEED)),
    )).reverse()
    expect(reverse).toEqual(forward)
  })
})

describe('#112 sequence temporal regression', () => {
  it('locks once transition/hold boundaries and program duration', () => {
    expect(animationProgramDurationMs(sequenceProgram)).toBe(650)
    const samples = [0, 100, 150, 200, 349, 350, 450, 550, 650]
      .map((timeMs) => sampleAnimationProgram(sequenceProgram, BASE, timeMs))
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

  it('keeps once/loop/ping-pong direct sampling independent of order and frame cadence', () => {
    for (const playbackMode of ['once', 'loop', 'ping-pong'] as const) {
      const program = { ...sequenceProgram, id: `fixture:${playbackMode}`, playbackMode }
      const duration = animationProgramDurationMs(program)
      const times = [0, 150, 350, Math.max(0, duration - 1), duration, duration + 150]
      const direct = times.map((timeMs) => frameSignature(sampleAnimationProgram(program, BASE, timeMs).model))
      const reverse = [...times].reverse()
        .map((timeMs) => frameSignature(sampleAnimationProgram(program, BASE, timeMs).model)).reverse()
      expect(reverse, playbackMode).toEqual(direct)

      for (const frameRate of FRAME_RATES) {
        for (const timeMs of times) {
          const positionMs = playbackPositionAt(frameRate, timeMs)
          expect(frameSignature(sampleAnimationProgram(program, BASE, positionMs).model), `${playbackMode} ${frameRate}Hz ${timeMs}ms`)
            .toEqual(frameSignature(sampleAnimationProgram(program, BASE, timeMs).model))
        }
      }
    }
  })

  it('has no unintended jump across authored transition boundaries', () => {
    for (const playbackMode of ['once', 'loop', 'ping-pong'] as const) {
      const program = { ...sequenceProgram, id: `fixture:continuity:${playbackMode}`, playbackMode }
      const duration = animationProgramDurationMs(program)
      const boundaries = [100, 350, ...(playbackMode === 'once' ? [] : [duration])]
      for (const boundary of boundaries) {
        const before = sampleAnimationProgram(program, BASE, Math.max(0, boundary - 0.001)).model
        const at = sampleAnimationProgram(program, BASE, boundary).model
        expect(Math.abs(before.gaze.x - at.gaze.x), `${playbackMode} boundary ${boundary}`).toBeLessThan(0.01)
        expect(Math.abs(before.gaze.y - at.gaze.y), `${playbackMode} boundary ${boundary}`).toBeLessThan(0.01)
      }
    }
  })
})

describe('temporal invariant sweeps', () => {
  it('keeps transitions, one-shots, profiles, and sequences valid over many timestamps/seeds without mutating authored state', () => {
    const beforeBase = JSON.stringify(BASE)
    const beforeTransition = JSON.stringify(geometryTransition)
    const beforeProgram = JSON.stringify(sequenceProgram)
    const motionEvents = normalizeRuntimeAnimationEvents([
      runtimeEvent('confused', 'motion-offset', 'confused', 200),
      runtimeEvent('laugh', 'motion-offset', 'laugh', 900, 1),
    ])

    for (const seed of [0, 1, 17, SEED, 0xffff_ffff]) {
      for (let timeMs = 0; timeMs <= 5_000; timeMs += 37) {
        assertFrameInvariants(sampleFaceTransition(geometryTransition, BASE, timeMs))
        assertFrameInvariants(resolveIdleGazeForSweep(timeMs, seed))

        const motionFrame = evaluateAnimationFrame({
          baseModel: BASE,
          context: createAnimationFrameContext(timeMs, seed),
          runtimeEvents: motionEvents,
          channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
        }).model
        assertFrameInvariants(motionFrame)

        const profileBase: FaceModel = { ...BASE, expression: expression('expression:happy') }
        assertFrameInvariants(evaluateBehaviorProfileFrame(
          happyBehaviorProfile,
          profileBase,
          createAnimationFrameContext(timeMs, seed),
        ))
        assertFrameInvariants(sampleAnimationProgram({ ...sequenceProgram, playbackMode: 'loop' }, BASE, timeMs).model)
      }
    }

    expect(JSON.stringify(BASE)).toBe(beforeBase)
    expect(JSON.stringify(geometryTransition)).toBe(beforeTransition)
    expect(JSON.stringify(sequenceProgram)).toBe(beforeProgram)
  })

  it('removes temporary runtime offsets after completion and preserves static renderer output when animation is absent', () => {
    const motionEvents = normalizeRuntimeAnimationEvents([runtimeEvent('confused', 'motion-offset', 'confused', 100)])
    const completed = evaluateAnimationFrame({
      baseModel: BASE,
      context: createAnimationFrameContext(600, SEED),
      runtimeEvents: motionEvents,
      channelResolvers: { 'motion-offset': motionOffsetChannelResolver },
    }).model
    expect(completed).toEqual(BASE)

    const staticFrame = evaluateAnimationFrame({
      baseModel: BASE,
      context: createAnimationFrameContext(123_456, SEED),
    }).model
    expect(renderFaceToSvg(staticFrame)).toBe(renderFaceToSvg(BASE))
  })
})

function resolveIdleGazeForSweep(timeMs: number, seed: number): FaceModel {
  return evaluateAnimationFrame({
    baseModel: BASE,
    definition: {
      version: 1,
      enabled: true,
      channels: { 'gaze-pose': idleDefinition as unknown as JsonValue },
    },
    context: createAnimationFrameContext(timeMs, seed),
    channelResolvers: { 'gaze-pose': idleGazeChannelResolver },
  }).model
}

describe('versioned temporal data round trips', () => {
  it('preserves animation/program identities, timing, easing, actions, and seed through JSON and face-preset round trips', () => {
    const defaults = normalizePresetAnimationDefaults({
      version: 1,
      seed: SEED,
      behaviorProfile: happyBehaviorProfile,
      definition: {
        version: 1,
        enabled: true,
        channels: { 'eye-openness': { kind: 'eye-openness' } },
      },
      program: sequenceProgram,
    })
    const defaultsRoundTrip = normalizePresetAnimationDefaults(JSON.parse(JSON.stringify(defaults)))
    expect(defaultsRoundTrip).toEqual(defaults)
    if (defaultsRoundTrip.version !== 1) throw new Error('Expected v1 animation defaults')
    expect(defaultsRoundTrip.seed).toBe(SEED)
    expect(defaultsRoundTrip.program?.id).toBe('fixture:sequence')
    expect(defaultsRoundTrip.program?.steps.map((step) => step.id)).toEqual(['neutral', 'happy', 'angry'])
    expect(defaultsRoundTrip.program?.steps[1].actions?.[0].id).toBe('blink')
    expect(defaultsRoundTrip.program?.steps[2].easing).toBe('ease-in-out')

    const normalizedProgram = normalizeAnimationProgram(JSON.parse(JSON.stringify(sequenceProgram)))
    expect(normalizedProgram).toEqual(sequenceProgram)

    const preset = {
      ...roboEyesPreset,
      id: 'custom:temporal-regression',
      name: 'Temporal regression',
      animationDefaults: defaults,
    }
    const parsed = parsePreset(serializePreset(preset))
    expect(parsed.animationDefaults).toEqual(defaults)
    if (parsed.animationDefaults.version !== 1) throw new Error('Expected v1 parsed animation defaults')
    expect(parsed.animationDefaults.program?.id).toBe('fixture:sequence')
    expect(parsed.animationDefaults.program?.steps[1].actions?.[0].id).toBe('blink')
  })
})
