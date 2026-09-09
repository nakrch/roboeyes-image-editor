import { describe, expect, it } from 'vitest'
import {
  normalizeEyeOpennessDefinition,
  normalizeRuntimeAnimationEvents,
  resolveEyeOpenness,
  resolveMotionOffset,
  sampleFaceTransition,
  scheduledAutoBlinkEvents,
  scheduledIdleGazeTargets,
} from './index'
import {
  TEMPORAL_BASE,
  TEMPORAL_SEED,
  temporalAutoBlinkDefinition,
  temporalGeometryTransition,
  temporalIdleDefinition,
  temporalRound,
  temporalRuntimeEvent,
  temporalTransitionFixtureSignature,
} from './temporalRegressionSupport'

describe('temporal exact regression fixtures', () => {
  it('locks transition geometry, spacing, gaze, radius, rotation, and expression at start/mid/end', () => {
    expect([100, 500, 900].map((timeMs) =>
      temporalTransitionFixtureSignature(sampleFaceTransition(temporalGeometryTransition, TEMPORAL_BASE, timeMs)),
    )).toEqual([
      [40, 88, 36, 36, 36, 36, 8, 8, 0, 0, 12, 0, 0, 0, 0, 0, 0],
      [38.5, 89.5, 33, 39, 32, 34, 7, 9, -5, 5, 15, 4, -2, 0.14, 0.22, 0.14, 0.22],
      [37, 91, 30, 42, 28, 32, 6, 10, -10, 10, 18, 8, -4, 0.28, 0.44, 0.28, 0.44],
    ])
  })

  it('locks blink, independent wink, persistent close/sleep, reopen, and simultaneous priority timing', () => {
    const eyeDefinition = normalizeEyeOpennessDefinition({ kind: 'eye-openness' })
    const blink = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('blink', 'eye-openness', 'blink', 100),
    ])
    expect([100, 180, 200, 260, 320].map((timeMs) => {
      const resolved = resolveEyeOpenness(eyeDefinition, blink, timeMs)
      return [temporalRound(resolved.left), temporalRound(resolved.right)]
    })).toEqual([[1, 1], [0, 0], [0, 0], [0.5, 0.5], [1, 1]])

    const leftWink = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('left', 'eye-openness', 'wink-left', 0),
    ])
    const rightWink = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('right', 'eye-openness', 'wink-right', 0),
    ])
    expect(resolveEyeOpenness(eyeDefinition, leftWink, 80)).toMatchObject({ left: 0, right: 1 })
    expect(resolveEyeOpenness(eyeDefinition, rightWink, 80)).toMatchObject({ left: 1, right: 0 })

    const closeThenOpen = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('close', 'eye-openness', 'close', 100),
      temporalRuntimeEvent('open', 'eye-openness', 'open', 1_000, 1),
    ])
    expect(resolveEyeOpenness(eyeDefinition, closeThenOpen, 900)).toMatchObject({ left: 0, right: 0, state: 'closed' })
    expect(resolveEyeOpenness(eyeDefinition, closeThenOpen, 1_120)).toMatchObject({ left: 1, right: 1, state: 'open' })

    const sleepThenOpen = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('sleep', 'eye-openness', 'sleep', 0),
      temporalRuntimeEvent('open', 'eye-openness', 'open', 1_000, 1),
    ])
    expect(resolveEyeOpenness(eyeDefinition, sleepThenOpen, 900)).toMatchObject({ left: 0, right: 0, state: 'sleep' })
    expect(resolveEyeOpenness(eyeDefinition, sleepThenOpen, 1_120)).toMatchObject({ left: 1, right: 1, state: 'open' })

    const conflict = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('close', 'eye-openness', 'close', 100, 0, 0),
      temporalRuntimeEvent('open', 'eye-openness', 'open', 100, 0, 10),
    ])
    expect(resolveEyeOpenness(eyeDefinition, conflict, 300)).toMatchObject({ left: 1, right: 1, state: 'open' })
  })

  it('locks horizontal/vertical one-shot sign, phase, and completion samples', () => {
    const confused = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('confused', 'motion-offset', 'confused', 100),
    ])
    expect([100, 120, 140, 599, 600].map((timeMs) => {
      const resolved = resolveMotionOffset(confused, timeMs, TEMPORAL_SEED)
      return [temporalRound(resolved.x), temporalRound(resolved.y), resolved.active]
    })).toEqual([
      [-20, 0, true],
      [20, 0, true],
      [-20, 0, true],
      [-20, 0, true],
      [0, 0, false],
    ])

    const laugh = normalizeRuntimeAnimationEvents([
      temporalRuntimeEvent('laugh', 'motion-offset', 'laugh', 0),
    ])
    expect([0, 20, 40, 499, 500].map((timeMs) => {
      const resolved = resolveMotionOffset(laugh, timeMs, TEMPORAL_SEED)
      return [temporalRound(resolved.x), temporalRound(resolved.y), resolved.active]
    })).toEqual([
      [0, -5, true],
      [0, 5, true],
      [0, -5, true],
      [0, -5, true],
      [0, 0, false],
    ])
  })

  it('locks a fixed-seed Auto-blink schedule with non-zero variation', () => {
    const times = scheduledAutoBlinkEvents(temporalAutoBlinkDefinition, [], 10_000, TEMPORAL_SEED)
      .map((event) => temporalRound(event.startTimeMs, 6))
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

  it('locks fixed-seed Idle target times and coordinates with non-zero variation', () => {
    const targets = scheduledIdleGazeTargets(
      temporalIdleDefinition,
      [],
      TEMPORAL_BASE,
      6_000,
      TEMPORAL_SEED,
    ).map((entry) => [
      entry.targetIndex,
      temporalRound(entry.startTimeMs, 6),
      temporalRound(entry.target.x, 6),
      temporalRound(entry.target.y, 6),
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
