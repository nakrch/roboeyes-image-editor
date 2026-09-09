import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../core/presets'
import {
  normalizeTransientEffectLayerDefinition,
  resolveTransientEffectFrame,
  type TransientEffectLayerDefinition,
} from './transientEffects'
import type { RuntimeAnimationEvent } from './runtime'

const fixedSweat: TransientEffectLayerDefinition = {
  kind: 'transient-effect-layer',
  effects: [{
    kind: 'sweat',
    id: 'sweat:test',
    enabled: true,
    startTimeMs: 0,
    dropCount: 3,
    minTargetY: 12,
    maxTargetY: 12,
    fallSpeed: 0.025,
    radius: 3,
  }],
}

function event(
  id: string,
  action: 'sweat-enable' | 'sweat-disable',
  startTimeMs: number,
  order = 0,
): RuntimeAnimationEvent {
  return { id, channel: 'transient-effect', action, startTimeMs, order }
}

describe('transient effect definitions', () => {
  it('normalizes serializable generic effect-layer data and rejects unknown fields/kinds', () => {
    const normalized = normalizeTransientEffectLayerDefinition(fixedSweat)
    expect(normalized.kind).toBe('transient-effect-layer')
    expect(normalized.effects).toHaveLength(1)
    expect(normalized.effects[0]).toMatchObject({
      kind: 'sweat',
      id: 'sweat:test',
      enabled: true,
      dropCount: 3,
      minTargetY: 12,
      maxTargetY: 12,
      fallSpeed: 0.025,
      radius: 3,
    })
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)

    expect(() => normalizeTransientEffectLayerDefinition({
      kind: 'transient-effect-layer',
      effects: [{ kind: 'sparkles', id: 'future' }],
    })).toThrow(/Unsupported transient effect kind/)
    expect(() => normalizeTransientEffectLayerDefinition({
      kind: 'transient-effect-layer',
      effects: [{ kind: 'sweat', id: 'sweat', hiddenRuntimeCursor: 2 }],
    })).toThrow(/unsupported field/)
  })
})

describe('deterministic animated sweat', () => {
  it('samples recognizable teardrop start, mid, and reset frames from explicit time', () => {
    const base = roboEyesPreset.model
    const start = resolveTransientEffectFrame(fixedSweat, [], base, 0, 17)
    const mid = resolveTransientEffectFrame(fixedSweat, [], base, 200, 17)
    const reset = resolveTransientEffectFrame(fixedSweat, [], base, 400, 17)

    expect(start.overlays).toHaveLength(3)
    expect(start.overlays.every((drop) => drop.kind === 'teardrop')).toBe(true)
    expect(start.overlays.every((drop) => drop.y === 2 && drop.width === 1.8 && drop.height === 3.2)).toBe(true)
    expect(mid.overlays).toHaveLength(3)
    expect(mid.overlays.every((drop) => drop.kind === 'teardrop' && drop.y === 7)).toBe(true)
    expect(mid.overlays.every((drop) => drop.width > 5 && drop.height > 5)).toBe(true)
    expect(reset.overlays).toHaveLength(3)
    expect(reset.overlays.every((drop) => drop.y === 2 && drop.width === 1.8 && drop.height === 3.2)).toBe(true)
    expect(reset.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
  })

  it('scales shape and distance on larger canvases while stretching cycle duration proportionally', () => {
    const large = structuredClone(roboEyesPreset.model)
    large.canvas = { width: 240, height: 240 }
    const scale = 240 / 64

    const largeStart = resolveTransientEffectFrame(fixedSweat, [], large, 0, 17)
    const largeAt400 = resolveTransientEffectFrame(fixedSweat, [], large, 400, 17)
    const largeReset = resolveTransientEffectFrame(fixedSweat, [], large, 400 * scale, 17)

    expect(largeStart.overlays).toHaveLength(3)
    expect(largeStart.overlays[0].width).toBeCloseTo(1.8 * scale)
    expect(largeStart.overlays[0].height).toBeCloseTo(3.2 * scale)
    expect(largeStart.overlays[0].y).toBeCloseTo(2 * scale)
    expect(largeAt400.overlays.every((drop) => drop.id.includes('cycle-0'))).toBe(true)
    expect(largeAt400.overlays[0].y).toBeLessThan(12 * scale)
    expect(largeReset.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
    expect(largeReset.overlays[0].y).toBeCloseTo(2 * scale)
  })

  it('is repeatable and sampling-order independent for the same time + seed', () => {
    const base = roboEyesPreset.model
    const direct = resolveTransientEffectFrame(fixedSweat, [], base, 1_750, 0x1234abcd)
    for (const timeMs of [0, 400, 900, 250, 1_500]) {
      resolveTransientEffectFrame(fixedSweat, [], base, timeMs, 0x1234abcd)
    }
    expect(resolveTransientEffectFrame(fixedSweat, [], base, 1_750, 0x1234abcd)).toEqual(direct)
    expect(resolveTransientEffectFrame(fixedSweat, [], base, 1_750, 99)).not.toEqual(direct)
  })

  it('supports explicit runtime enable/disable/re-enable without wall-clock state', () => {
    const disabled: TransientEffectLayerDefinition = {
      ...fixedSweat,
      effects: [{ ...fixedSweat.effects[0], enabled: false }],
    }
    const events = [
      event('on', 'sweat-enable', 100),
      event('off', 'sweat-disable', 250, 1),
      event('on-again', 'sweat-enable', 500, 2),
    ]

    expect(resolveTransientEffectFrame(disabled, events, roboEyesPreset.model, 99, 1).overlays).toHaveLength(0)
    expect(resolveTransientEffectFrame(disabled, events, roboEyesPreset.model, 100, 1).overlays).toHaveLength(3)
    expect(resolveTransientEffectFrame(disabled, events, roboEyesPreset.model, 300, 1).overlays).toHaveLength(0)
    const reenabled = resolveTransientEffectFrame(disabled, events, roboEyesPreset.model, 500, 1)
    expect(reenabled.overlays).toHaveLength(3)
    expect(reenabled.overlays.every((drop) => drop.y === 2)).toBe(true)
  })

  it('keeps overlays inside the canvas and never mutates base face geometry/state', () => {
    const base = structuredClone(roboEyesPreset.model)
    const before = structuredClone(base)
    for (const seed of [0, 1, 17, 0xffff_ffff]) {
      for (let timeMs = 0; timeMs <= 5_000; timeMs += 37) {
        const frame = resolveTransientEffectFrame(fixedSweat, [], base, timeMs, seed)
        for (const drop of frame.overlays) {
          expect(drop.x).toBeGreaterThanOrEqual(0)
          expect(drop.y).toBeGreaterThanOrEqual(0)
          expect(drop.x + drop.width).toBeLessThanOrEqual(base.canvas.width + 1e-9)
          expect(drop.y + drop.height).toBeLessThanOrEqual(base.canvas.height + 1e-9)
          expect(drop.width).toBeGreaterThan(0)
          expect(drop.height).toBeGreaterThan(0)
        }
      }
    }
    expect(base).toEqual(before)
  })
})
