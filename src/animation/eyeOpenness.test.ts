import { describe, expect, it } from 'vitest'
import { expressionPresets, roboEyesPreset } from '../core/presets'
import { renderFaceToSvg } from '../renderers/svg'
import {
  createAnimationFrameContext,
  evaluateAnimationFrame,
  normalizeRuntimeAnimationEvents,
  type RuntimeAnimationEvent,
} from './runtime'
import {
  applyEyeOpenness,
  DEFAULT_EYE_OPENNESS_TIMING,
  EYE_OPENNESS_KIND,
  eyeOpennessChannelResolver,
  normalizeEyeOpennessDefinition,
  resolveEyeOpenness,
} from './eyeOpenness'

const definition = normalizeEyeOpennessDefinition({ kind: EYE_OPENNESS_KIND })

function event(
  id: string,
  action: RuntimeAnimationEvent['action'],
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

describe('eye openness definition', () => {
  it('provides stable reference-compatible defaults and validates serializable fields', () => {
    expect(definition).toEqual({
      kind: EYE_OPENNESS_KIND,
      state: 'open',
      ...DEFAULT_EYE_OPENNESS_TIMING,
    })
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition)
    expect(() => normalizeEyeOpennessDefinition({ kind: EYE_OPENNESS_KIND, closedScale: 1.1 })).toThrow(
      /between 0 and 1/,
    )
    expect(() => normalizeEyeOpennessDefinition({ kind: EYE_OPENNESS_KIND, easing: 'spring' })).toThrow(
      /supported easing id/,
    )
  })
})

describe('blink and wink', () => {
  it('closes, holds, and reopens both eyes deterministically from explicit time', () => {
    const events = normalized(event('blink-1', 'blink', 100))

    expect(resolveEyeOpenness(definition, events, 100)).toMatchObject({ left: 1, right: 1 })
    expect(resolveEyeOpenness(definition, events, 180)).toMatchObject({ left: 0, right: 0 })
    expect(resolveEyeOpenness(definition, events, 200)).toMatchObject({ left: 0, right: 0 })
    expect(resolveEyeOpenness(definition, events, 260)).toMatchObject({ left: 0.5, right: 0.5 })
    expect(resolveEyeOpenness(definition, events, 320)).toMatchObject({ left: 1, right: 1 })

    const reverse = [320, 260, 200, 180, 100].map((timeMs) => resolveEyeOpenness(definition, events, timeMs))
    const forward = [100, 180, 200, 260, 320].map((timeMs) => resolveEyeOpenness(definition, events, timeMs))
    expect(reverse.reverse()).toEqual(forward)
  })

  it('winks left and right independently', () => {
    const left = normalized(event('left', 'wink-left', 0))
    const right = normalized(event('right', 'wink-right', 0))

    expect(resolveEyeOpenness(definition, left, 80)).toMatchObject({ left: 0, right: 1 })
    expect(resolveEyeOpenness(definition, right, 80)).toMatchObject({ left: 1, right: 0 })
  })

  it('supports event-local timing overrides without changing authored defaults', () => {
    const events = normalized(event('fast', 'blink', 0, 0, {
      closeDurationMs: 10,
      holdDurationMs: 0,
      openDurationMs: 10,
      easing: 'linear',
    }))

    expect(resolveEyeOpenness(definition, events, 5).left).toBeCloseTo(0.5)
    expect(resolveEyeOpenness(definition, events, 10).left).toBe(0)
    expect(resolveEyeOpenness(definition, events, 15).left).toBeCloseTo(0.5)
    expect(resolveEyeOpenness(definition, events, 20).left).toBe(1)
    expect(definition.closeDurationMs).toBe(DEFAULT_EYE_OPENNESS_TIMING.closeDurationMs)
  })
})

describe('persistent open/close/sleep state', () => {
  it('keeps close persistent until an explicit open event', () => {
    const events = normalized(
      event('close', 'close', 100),
      event('open', 'open', 1_000, 1),
    )

    expect(resolveEyeOpenness(definition, events, 180)).toMatchObject({ left: 0, right: 0, state: 'closed' })
    expect(resolveEyeOpenness(definition, events, 900)).toMatchObject({ left: 0, right: 0, state: 'closed' })
    expect(resolveEyeOpenness(definition, events, 1_000)).toMatchObject({ left: 0, right: 0, state: 'open' })
    expect(resolveEyeOpenness(definition, events, 1_120)).toMatchObject({ left: 1, right: 1, state: 'open' })
  })

  it('represents sleep as persistent closed temporal state and ignores blink until reopened', () => {
    const events = normalized(
      event('sleep', 'sleep', 0),
      event('blink-ignored', 'blink', 500, 1),
      event('open', 'open', 1_000, 2),
    )

    expect(resolveEyeOpenness(definition, events, 500)).toMatchObject({ left: 0, right: 0, state: 'sleep' })
    expect(resolveEyeOpenness(definition, events, 900)).toMatchObject({ left: 0, right: 0, state: 'sleep' })
    expect(resolveEyeOpenness(definition, events, 1_120)).toMatchObject({ left: 1, right: 1, state: 'open' })
  })

  it('supports authored sleep/closed state without a renderer mood string', () => {
    const sleep = normalizeEyeOpennessDefinition({ kind: EYE_OPENNESS_KIND, state: 'sleep' })
    expect(resolveEyeOpenness(sleep, [], 0)).toEqual({ left: 0, right: 0, state: 'sleep' })
    expect(resolveEyeOpenness(sleep, [], 50_000)).toEqual({ left: 0, right: 0, state: 'sleep' })
  })
})

describe('interruption and retrigger semantics', () => {
  it('restarts a blink from the exact currently resolved openness without snapping', () => {
    const first = normalized(event('first', 'blink', 0))
    const beforeRetrigger = resolveEyeOpenness(definition, first, 140)
    const retriggered = normalized(
      event('first', 'blink', 0),
      event('second', 'blink', 140, 1),
    )
    const atRetrigger = resolveEyeOpenness(definition, retriggered, 140)

    expect(atRetrigger.left).toBeCloseTo(beforeRetrigger.left)
    expect(atRetrigger.right).toBeCloseTo(beforeRetrigger.right)
    expect(resolveEyeOpenness(definition, retriggered, 220).left).toBe(0)
  })

  it('lets a wink retarget one eye while the other eye continues its existing blink', () => {
    const events = normalized(
      event('blink', 'blink', 0),
      event('left-wink', 'wink-left', 140, 1),
    )

    const at220 = resolveEyeOpenness(definition, events, 220)
    expect(at220.left).toBe(0)
    expect(at220.right).toBe(1)
  })

  it('lets persistent close interrupt a blink and rebase from current openness', () => {
    const blinkOnly = normalized(event('blink', 'blink', 0))
    const beforeClose = resolveEyeOpenness(definition, blinkOnly, 140)
    const interrupted = normalized(
      event('blink', 'blink', 0),
      event('close', 'close', 140, 1),
    )

    expect(resolveEyeOpenness(definition, interrupted, 140).left).toBeCloseTo(beforeClose.left)
    expect(resolveEyeOpenness(definition, interrupted, 220)).toMatchObject({ left: 0, right: 0, state: 'closed' })
  })

  it('inherits #98 simultaneous priority/order semantics', () => {
    const events = normalizeRuntimeAnimationEvents([
      { ...event('close', 'close', 100, 0), priority: 0 },
      { ...event('open', 'open', 100, 0), priority: 10 },
    ])
    expect(resolveEyeOpenness(definition, events, 300)).toMatchObject({ left: 1, right: 1, state: 'open' })
  })
})

describe('FaceModel integration', () => {
  it('changes height around the existing eye center without mutating expression', () => {
    const model = roboEyesPreset.model
    const closedHalf = applyEyeOpenness(model, { left: 0.5, right: 0.5 })

    expect(closedHalf.leftEye.geometry.position).toEqual(model.leftEye.geometry.position)
    expect(closedHalf.rightEye.geometry.position).toEqual(model.rightEye.geometry.position)
    expect(closedHalf.leftEye.geometry.height).toBe(model.leftEye.geometry.height * 0.5)
    expect(closedHalf.rightEye.geometry.height).toBe(model.rightEye.geometry.height * 0.5)
    expect(closedHalf.expression).toEqual(model.expression)
    expect(closedHalf.expression).not.toBe(model.expression)
  })

  it('preserves every core expression exactly after blink reopening', () => {
    const events = normalized(event('blink', 'blink', 0))

    for (const preset of expressionPresets) {
      const model = { ...roboEyesPreset.model, expression: preset.expression }
      const before = renderFaceToSvg(model)
      const resolved = applyEyeOpenness(model, resolveEyeOpenness(definition, events, 500))

      expect(resolved.expression).toEqual(preset.expression)
      expect(renderFaceToSvg(resolved), preset.id).toBe(before)
    }
  })

  it('integrates with the #98 eye-openness channel resolver deterministically', () => {
    const runtimeEvent = event('blink', 'blink', 100)
    const animationDefinition = {
      version: 1 as const,
      enabled: true,
      channels: {
        'eye-openness': { kind: EYE_OPENNESS_KIND },
      },
    }
    const sample = (timeMs: number) => evaluateAnimationFrame({
      baseModel: roboEyesPreset.model,
      definition: animationDefinition,
      context: createAnimationFrameContext(timeMs, 7),
      runtimeEvents: [runtimeEvent],
      channelResolvers: { 'eye-openness': eyeOpennessChannelResolver },
    }).model

    const closed = sample(180)
    expect(closed.leftEye.geometry.height).toBe(0)
    expect(closed.rightEye.geometry.height).toBe(0)
    expect(sample(320)).toEqual(roboEyesPreset.model)
    expect(sample(180)).toEqual(closed)
  })
})
