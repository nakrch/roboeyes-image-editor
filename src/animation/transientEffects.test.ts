import { describe, expect, it } from 'vitest'
import type { EyeGeometry, FaceModel } from '../core/model'
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
    minTargetY: 8,
    maxTargetY: 8,
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

function verticalHalfExtent(geometry: EyeGeometry): number {
  const radians = geometry.rotation * Math.PI / 180
  return Math.abs(Math.sin(radians)) * geometry.width / 2 +
    Math.abs(Math.cos(radians)) * geometry.height / 2
}

function topOfEyes(model: FaceModel): number {
  return Math.min(
    model.leftEye.geometry.position.y + model.gaze.y - verticalHalfExtent(model.leftEye.geometry),
    model.rightEye.geometry.position.y + model.gaze.y - verticalHalfExtent(model.rightEye.geometry),
  )
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
      minTargetY: 8,
      maxTargetY: 8,
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
  it('samples medium teardrop start/mid frames, then waits before the next fixed-cadence cycle', () => {
    const base = roboEyesPreset.model
    const start = resolveTransientEffectFrame(fixedSweat, [], base, 0, 17)
    const mid = resolveTransientEffectFrame(fixedSweat, [], base, 110, 17)
    const waiting = resolveTransientEffectFrame(fixedSweat, [], base, 300, 17)
    const reset = resolveTransientEffectFrame(fixedSweat, [], base, 400, 17)

    expect(start.overlays).toHaveLength(3)
    expect(start.overlays.every((drop) => drop.kind === 'teardrop')).toBe(true)
    expect(start.overlays.every((drop) => drop.y === 2 && drop.width === 1.3 && drop.height === 2.4)).toBe(true)

    expect(mid.overlays).toHaveLength(3)
    expect(mid.overlays.every((drop) => drop.kind === 'teardrop')).toBe(true)
    expect(mid.overlays.every((drop) => drop.y > 4 && drop.y < 5.5)).toBe(true)
    expect(mid.overlays.every((drop) => drop.width > 2.4 && drop.width < 2.8)).toBe(true)
    expect(mid.overlays.every((drop) => drop.height > 4.5 && drop.height <= 5)).toBe(true)

    expect(waiting.overlays).toHaveLength(0)
    expect(reset.overlays).toHaveLength(3)
    expect(reset.overlays.every((drop) => drop.y === 2 && drop.width === 1.3 && drop.height === 2.4)).toBe(true)
    expect(reset.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
  })

  it('keeps cycle frequency stable when eye-safe travel distance becomes shorter', () => {
    const base = structuredClone(roboEyesPreset.model)
    const shorter = structuredClone(base)
    shorter.leftEye.geometry.position.y = 30
    shorter.rightEye.geometry.position.y = 30

    const baseAt300 = resolveTransientEffectFrame(fixedSweat, [], base, 300, 17)
    const shortAt300 = resolveTransientEffectFrame(fixedSweat, [], shorter, 300, 17)
    const baseReset = resolveTransientEffectFrame(fixedSweat, [], base, 400, 17)
    const shortReset = resolveTransientEffectFrame(fixedSweat, [], shorter, 400, 17)

    expect(baseAt300.overlays).toHaveLength(0)
    expect(shortAt300.overlays).toHaveLength(0)
    expect(baseReset.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
    expect(shortReset.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
  })

  it('does not scale droplets with canvas alone and only weakly follows eye size', () => {
    const base = roboEyesPreset.model
    const baseStart = resolveTransientEffectFrame(fixedSweat, [], base, 0, 17)

    const largeCanvas = structuredClone(base)
    largeCanvas.canvas = { width: 240, height: 240 }
    const largeCanvasStart = resolveTransientEffectFrame(fixedSweat, [], largeCanvas, 0, 17)
    expect(largeCanvasStart.overlays[0].width).toBeCloseTo(baseStart.overlays[0].width)
    expect(largeCanvasStart.overlays[0].height).toBeCloseTo(baseStart.overlays[0].height)
    expect(largeCanvasStart.overlays[0].y).toBeCloseTo(baseStart.overlays[0].y)

    const largeEyes = structuredClone(base)
    largeEyes.canvas = { width: 256, height: 128 }
    largeEyes.leftEye.geometry.width = 72
    largeEyes.leftEye.geometry.height = 72
    largeEyes.leftEye.geometry.position.y = 64
    largeEyes.rightEye.geometry.width = 72
    largeEyes.rightEye.geometry.height = 72
    largeEyes.rightEye.geometry.position.y = 64
    const largeEyesStart = resolveTransientEffectFrame(fixedSweat, [], largeEyes, 0, 17)

    expect(largeEyesStart.overlays[0].width).toBeCloseTo(1.625)
    expect(largeEyesStart.overlays[0].height).toBeCloseTo(3)
    expect(largeEyesStart.overlays[0].y).toBeCloseTo(4)
    expect(largeEyesStart.overlays[0].width).toBeLessThan(baseStart.overlays[0].width * 1.5)
  })

  it('keeps every droplet above the rendered eye bounds, including gaze and rotation', () => {
    const variants: FaceModel[] = [structuredClone(roboEyesPreset.model)]

    const gazed = structuredClone(roboEyesPreset.model)
    gazed.gaze.y = -3
    variants.push(gazed)

    const rotated = structuredClone(roboEyesPreset.model)
    rotated.leftEye.geometry.rotation = 10
    rotated.rightEye.geometry.rotation = -10
    variants.push(rotated)

    for (const model of variants) {
      let sampled = 0
      for (let timeMs = 0; timeMs <= 2_000; timeMs += 29) {
        const frame = resolveTransientEffectFrame(fixedSweat, [], model, timeMs, 17)
        for (const drop of frame.overlays) {
          sampled += 1
          expect(drop.y + drop.height).toBeLessThan(topOfEyes(model))
        }
      }
      expect(sampled).toBeGreaterThan(0)
    }
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
          expect(drop.y + drop.height).toBeLessThan(topOfEyes(base))
          expect(drop.width).toBeGreaterThan(0)
          expect(drop.height).toBeGreaterThan(0)
        }
      }
    }
    expect(base).toEqual(before)
  })
})
