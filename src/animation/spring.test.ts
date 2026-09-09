import { describe, expect, it } from 'vitest'
import {
  areEyeLidAperturesValid,
  isGazeCanvasSafe,
  type FaceModel,
} from '../core/model'
import { expressionPresets } from '../core/presets'
import {
  createFaceTransition,
  createSpringFaceTransition,
  retargetSpringFaceTransition,
  sampleGenericFaceTransition,
  sampleSpringFaceTransition,
  springPreset,
  springResponse,
  SPRING_PRESETS,
} from './index'

const baseModel: FaceModel = {
  canvas: { width: 128, height: 64 },
  leftEye: { geometry: { position: { x: 40, y: 32 }, width: 36, height: 30, cornerRadius: 8, rotation: 0 } },
  rightEye: { geometry: { position: { x: 88, y: 32 }, width: 36, height: 30, cornerRadius: 8, rotation: 0 } },
  gaze: { x: 0, y: 0 },
  expression: { upperLid: 0, lowerLid: 0, tilt: 0 },
  colors: { eye: '#ffffff', stroke: '#ffffff', background: '#000000' },
}

const happy = expressionPresets.find((preset) => preset.id === 'expression:happy')!.expression

describe('spring response', () => {
  it('has deterministic fixed-time samples for a JSON-safe preset', () => {
    const gentle = springPreset('gentle')
    expect(JSON.parse(JSON.stringify(gentle))).toEqual(gentle)
    expect(springResponse(gentle, 100)).toBeCloseTo(0.2986944125, 8)
    expect(springResponse(gentle, 200)).toBeCloseTo(0.6415780670, 8)
    expect(springResponse(gentle, 500)).toBeCloseTo(0.9719660789, 8)
  })

  it('supports an underdamped profile while keeping its physical overshoot explicit', () => {
    expect(springResponse(SPRING_PRESETS.bouncy, 200)).toBeGreaterThan(1)
  })
})

describe('generic spring FaceModel transition', () => {
  it('samples identically at the same timestamp regardless of prior cadence', () => {
    const transition = createSpringFaceTransition(
      'spring:gaze',
      { gaze: { x: 10, y: 4 }, expression: happy },
      0,
      900,
      springPreset('gentle'),
    )
    const direct = sampleSpringFaceTransition(transition, baseModel, 420)
    for (const time of [16, 32, 80, 160, 240, 360]) sampleSpringFaceTransition(transition, baseModel, time)
    expect(sampleSpringFaceTransition(transition, baseModel, 420)).toEqual(direct)
  })

  it('retargets from the exact in-flight resolved model without snapping', () => {
    const first = createSpringFaceTransition('spring:right', { gaze: { x: 10 } }, 0, 900, springPreset('bouncy'))
    const before = sampleSpringFaceTransition(first, baseModel, 280)
    const second = retargetSpringFaceTransition(first, baseModel, { gaze: { x: -8 } }, 280, {
      id: 'spring:left',
      durationMs: 700,
      spring: springPreset('snappy'),
    })
    expect(sampleSpringFaceTransition(second, baseModel, 280)).toEqual(before)
    expect(second.from).toEqual(before)
  })

  it('clamps physical overshoot at the model boundary and preserves safety invariants', () => {
    const transition = createSpringFaceTransition(
      'spring:safe',
      { gaze: { x: 10_000, y: -10_000 }, expression: happy },
      0,
      1_000,
      springPreset('bouncy'),
    )
    for (let time = 0; time <= 1_000; time += 20) {
      const frame = sampleSpringFaceTransition(transition, baseModel, time)
      expect(isGazeCanvasSafe(frame)).toBe(true)
      expect(areEyeLidAperturesValid(frame.expression)).toBe(true)
    }
  })

  it('coexists with easing transitions through one generic sampler', () => {
    const easing = createFaceTransition('ease', { gaze: { x: 6 } }, 0, 600, 'ease-in-out')
    const spring = createSpringFaceTransition('spring', { gaze: { x: 6 } }, 0, 600, springPreset('gentle'))
    expect(sampleGenericFaceTransition(easing, baseModel, 300).gaze.x).toBeGreaterThan(0)
    expect(sampleGenericFaceTransition(spring, baseModel, 300).gaze.x).toBeGreaterThan(0)
  })

  it('round-trips a serialized spring transition definition', () => {
    const transition = createSpringFaceTransition('spring:json', { gaze: { x: 4 }, expression: happy }, 10, 800, springPreset('snappy'))
    const restored = JSON.parse(JSON.stringify(transition))
    expect(sampleSpringFaceTransition(restored, baseModel, 360)).toEqual(sampleSpringFaceTransition(transition, baseModel, 360))
  })
})
