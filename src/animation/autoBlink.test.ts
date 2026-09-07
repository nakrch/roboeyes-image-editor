import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../core/presets'
import {
  AUTO_BLINK_EVENT_PRIORITY,
  DEFAULT_AUTO_BLINK,
  expandAutoBlinkEvents,
  normalizeAutoBlinkDefinition,
  scheduledAutoBlinkEvents,
} from './autoBlink'
import {
  EYE_OPENNESS_KIND,
  eyeOpennessChannelResolver,
  normalizeEyeOpennessDefinition,
  resolveEyeOpenness,
} from './eyeOpenness'
import {
  createAnimationFrameContext,
  evaluateAnimationFrame,
  normalizeRuntimeAnimationEvents,
  type RuntimeAnimationEvent,
} from './runtime'

function event(
  id: string,
  action: string,
  startTimeMs: number,
  order = 0,
  payload?: RuntimeAnimationEvent['payload'],
): RuntimeAnimationEvent {
  return {
    id,
    channel: 'eye-openness',
    action,
    startTimeMs,
    order,
    ...(payload === undefined ? {} : { payload }),
  }
}

function normalized(...events: RuntimeAnimationEvent[]) {
  return normalizeRuntimeAnimationEvents(events)
}

describe('auto-blink definition', () => {
  it('uses serializable RoboEyes-compatible base-plus-positive-variation defaults', () => {
    expect(normalizeAutoBlinkDefinition({})).toEqual(DEFAULT_AUTO_BLINK)
    expect(JSON.parse(JSON.stringify(normalizeAutoBlinkDefinition({})))).toEqual(DEFAULT_AUTO_BLINK)
  })

  it('validates interval and variation edge cases', () => {
    expect(() => normalizeAutoBlinkDefinition({ intervalMs: 0 })).toThrow(/greater than zero/)
    expect(() => normalizeAutoBlinkDefinition({ variationMs: -1 })).toThrow(/non-negative/)
    expect(normalizeAutoBlinkDefinition({ intervalMs: 250, variationMs: 0 })).toMatchObject({
      intervalMs: 250,
      variationMs: 0,
    })
  })
})

describe('deterministic schedule', () => {
  it('schedules the first blink after one full delay and supports zero variation', () => {
    const definition = normalizeAutoBlinkDefinition({
      enabled: true,
      intervalMs: 1_000,
      variationMs: 0,
    })

    expect(scheduledAutoBlinkEvents(definition, [], 999, 7)).toHaveLength(0)
    expect(scheduledAutoBlinkEvents(definition, [], 3_000, 7).map((entry) => entry.startTimeMs))
      .toEqual([1_000, 2_000, 3_000])
  })

  it('reproduces exactly for the same seed/config regardless of sampling order', () => {
    const definition = normalizeAutoBlinkDefinition({
      enabled: true,
      intervalMs: 1_000,
      variationMs: 4_000,
    })
    const direct = scheduledAutoBlinkEvents(definition, [], 20_000, 1234)

    for (const timeMs of [250, 10_000, 2_000, 20_000, 5_000]) {
      scheduledAutoBlinkEvents(definition, [], timeMs, 1234)
    }

    expect(scheduledAutoBlinkEvents(definition, [], 20_000, 1234)).toEqual(direct)
  })

  it('lets different seeds produce different schedules while respecting configured bounds', () => {
    const definition = normalizeAutoBlinkDefinition({
      enabled: true,
      intervalMs: 500,
      variationMs: 1_500,
    })
    const schedules = Array.from({ length: 5 }, (_, seed) =>
      scheduledAutoBlinkEvents(definition, [], 10_000, seed + 1).map((entry) => entry.startTimeMs),
    )

    expect(new Set(schedules.map((schedule) => JSON.stringify(schedule))).size).toBeGreaterThan(1)

    for (const schedule of schedules) {
      let previous = 0
      for (const timeMs of schedule) {
        const delay = timeMs - previous
        expect(delay).toBeGreaterThanOrEqual(500)
        expect(delay).toBeLessThan(2_000)
        previous = timeMs
      }
    }
  })

  it('produces no scheduled blink events while authored auto-blink is disabled', () => {
    expect(scheduledAutoBlinkEvents({ enabled: false }, [], 100_000, 7)).toEqual([])
  })
})

describe('runtime interaction semantics', () => {
  const enabled = normalizeAutoBlinkDefinition({
    enabled: true,
    intervalMs: 1_000,
    variationMs: 0,
  })

  it('does not reset the automatic schedule for manual blink or wink events', () => {
    const withoutManual = scheduledAutoBlinkEvents(enabled, [], 4_000, 99)
    const withManual = scheduledAutoBlinkEvents(enabled, normalized(
      event('manual-blink', 'blink', 350),
      event('manual-wink', 'wink-left', 1_450, 1),
    ), 4_000, 99)

    expect(withManual).toEqual(withoutManual)
  })

  it('disables immediately and re-enables from a new explicit schedule origin', () => {
    const controls = normalized(
      event('disable', 'auto-blink-disable', 2_500),
      event('enable', 'auto-blink-enable', 4_000, 1),
    )

    expect(scheduledAutoBlinkEvents(enabled, controls, 6_500, 11).map((entry) => entry.startTimeMs))
      .toEqual([1_000, 2_000, 5_000, 6_000])
  })

  it('allows re-enable to carry a new base interval and variation profile', () => {
    const controls = normalized(
      event('disable', 'auto-blink-disable', 2_500),
      event('enable-fast', 'auto-blink-enable', 4_000, 1, {
        intervalMs: 500,
        variationMs: 0,
      }),
    )

    expect(scheduledAutoBlinkEvents(enabled, controls, 5_200, 11).map((entry) => entry.startTimeMs))
      .toEqual([1_000, 2_000, 4_500, 5_000])
  })

  it('treats disable at an exact scheduled timestamp as suppressing that blink', () => {
    const controls = normalized(event('disable', 'auto-blink-disable', 1_000))
    expect(scheduledAutoBlinkEvents(enabled, controls, 2_000, 5)).toEqual([])
  })

  it('sorts automatic blinks before default-priority manual conflicts at the same timestamp', () => {
    const expanded = expandAutoBlinkEvents(enabled, normalized(
      event('manual-close', 'close', 1_000),
    ), 1_000, 7)

    expect(expanded.map((entry) => entry.action)).toEqual(['blink', 'close'])
    expect(expanded[0].priority).toBe(AUTO_BLINK_EVENT_PRIORITY)
    expect(expanded[1].priority).toBe(0)
  })

  it('suppresses scheduled blinks while closed without shifting future schedule', () => {
    const eyeDefinition = normalizeEyeOpennessDefinition({
      kind: EYE_OPENNESS_KIND,
      autoBlink: enabled,
    })
    const controls = normalized(
      event('close', 'close', 900),
      event('open', 'open', 1_500, 1),
    )
    const expanded = expandAutoBlinkEvents(enabled, controls, 2_080, 3)

    expect(expanded.filter((entry) => entry.action === 'blink').map((entry) => entry.startTimeMs))
      .toEqual([1_000, 2_000])
    expect(resolveEyeOpenness(eyeDefinition, expanded, 1_620).left).toBe(1)
    expect(resolveEyeOpenness(eyeDefinition, expanded, 2_080).left).toBe(0)
  })

  it('suppresses scheduled blinks during authored sleep and resumes only future slots after open', () => {
    const eyeDefinition = normalizeEyeOpennessDefinition({
      kind: EYE_OPENNESS_KIND,
      state: 'sleep',
      autoBlink: enabled,
    })
    const events = normalized(event('open', 'open', 1_500))
    const expanded = expandAutoBlinkEvents(enabled, events, 2_080, 3)

    expect(resolveEyeOpenness(eyeDefinition, expanded, 1_200)).toMatchObject({
      left: 0,
      right: 0,
      state: 'sleep',
    })
    expect(resolveEyeOpenness(eyeDefinition, expanded, 2_080).left).toBe(0)
  })
})

describe('eye-openness channel integration', () => {
  it('reuses the #100 blink primitive through the existing channel resolver', () => {
    const animationDefinition = {
      version: 1 as const,
      enabled: true,
      channels: {
        'eye-openness': {
          kind: EYE_OPENNESS_KIND,
          autoBlink: {
            enabled: true,
            intervalMs: 1_000,
            variationMs: 0,
          },
        },
      },
    }
    const sample = (timeMs: number) => evaluateAnimationFrame({
      baseModel: roboEyesPreset.model,
      definition: animationDefinition,
      context: createAnimationFrameContext(timeMs, 42),
      channelResolvers: { 'eye-openness': eyeOpennessChannelResolver },
    }).model

    expect(sample(999)).toEqual(roboEyesPreset.model)
    expect(sample(1_080).leftEye.geometry.height).toBe(0)
    expect(sample(1_080).rightEye.geometry.height).toBe(0)
    expect(sample(1_320)).toEqual(roboEyesPreset.model)
    expect(sample(1_080)).toEqual(sample(1_080))
  })

  it('can be enabled by explicit runtime control even when authored auto-blink is off', () => {
    const animationDefinition = {
      version: 1 as const,
      enabled: true,
      channels: {
        'eye-openness': { kind: EYE_OPENNESS_KIND },
      },
    }
    const runtimeEvents = [event('enable', 'auto-blink-enable', 500, 0, {
      intervalMs: 500,
      variationMs: 0,
    })]
    const resolved = evaluateAnimationFrame({
      baseModel: roboEyesPreset.model,
      definition: animationDefinition,
      context: createAnimationFrameContext(1_080, 9),
      runtimeEvents,
      channelResolvers: { 'eye-openness': eyeOpennessChannelResolver },
    }).model

    expect(resolved.leftEye.geometry.height).toBe(0)
    expect(resolved.rightEye.geometry.height).toBe(0)
  })
})
