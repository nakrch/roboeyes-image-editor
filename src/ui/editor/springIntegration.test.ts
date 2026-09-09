import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../../core/presets'
import {
  evaluateAnimationFrame,
  genericStateTransitionChannelResolver,
  normalizePersistedAnimationDefinition,
  normalizePresetAnimationDefaults,
  sampleAnimationProgram,
  SPRING_PRESETS,
  type AnimationDefinition,
  type AnimationProgram,
  type PresetAnimationDefaults,
} from '../../animation'
import { evaluateEditorAnimationFrame } from './animationPreview'

const springDefinition: AnimationDefinition = {
  version: 1,
  enabled: true,
  channels: {
    'state-transition': {
      kind: 'spring-face-model-transition',
      id: 'spring:gaze-right',
      startTimeMs: 0,
      durationMs: 800,
      spring: { ...SPRING_PRESETS.gentle },
      target: { gaze: { x: 10, y: 0 } },
    },
  },
}

const springProgram: AnimationProgram = {
  version: 1,
  id: 'program:spring-integration',
  playbackMode: 'once',
  steps: [
    {
      id: 'center',
      target: { gaze: { x: 0, y: 0 } },
      transitionDurationMs: 0,
      easing: 'linear',
      holdDurationMs: 100,
    },
    {
      id: 'right',
      target: { gaze: { x: 12, y: 0 } },
      transitionDurationMs: 700,
      easing: 'ease-in-out',
      spring: { ...SPRING_PRESETS.bouncy },
      holdDurationMs: 100,
    },
  ],
}

describe('Spring integration', () => {
  it('resolves serialized Spring data through the normal state-transition runtime channel', () => {
    const input = {
      baseModel: roboEyesPreset.model,
      definition: springDefinition,
      context: { timeMs: 300, seed: 1 },
      channelResolvers: { 'state-transition': genericStateTransitionChannelResolver },
    } as const

    const first = evaluateAnimationFrame(input).model
    const second = evaluateAnimationFrame(input).model
    expect(first.gaze.x).toBeGreaterThan(0)
    expect(first.gaze.x).toBeLessThanOrEqual(10)
    expect(second).toEqual(first)
  })

  it('round-trips persisted Spring state transitions and rejects runtime/unknown Spring fields', () => {
    const normalized = normalizePersistedAnimationDefinition(springDefinition)
    expect(normalized.channels?.['state-transition']).toEqual(springDefinition.channels?.['state-transition'])

    expect(() => normalizePersistedAnimationDefinition({
      ...springDefinition,
      channels: {
        'state-transition': {
          ...(springDefinition.channels?.['state-transition'] as Record<string, unknown>),
          from: roboEyesPreset.model,
        },
      },
    })).toThrow(/unsupported field: from/)

    expect(() => normalizePersistedAnimationDefinition({
      ...springDefinition,
      channels: {
        'state-transition': {
          ...(springDefinition.channels?.['state-transition'] as Record<string, unknown>),
          spring: { ...SPRING_PRESETS.gentle, hiddenRuntimeVelocity: 1 },
        },
      },
    })).toThrow(/unsupported field: hiddenRuntimeVelocity/)
  })

  it('persists and samples Spring entry transitions in ordered state programs', () => {
    const defaults = normalizePresetAnimationDefaults({
      version: 1,
      program: springProgram,
    })
    if (defaults.version !== 1 || defaults.program === undefined) {
      throw new Error('Expected persisted Spring program')
    }

    expect(defaults.program.steps[1].spring).toEqual(SPRING_PRESETS.bouncy)
    const first = sampleAnimationProgram(defaults.program, roboEyesPreset.model, 300)
    const second = sampleAnimationProgram(defaults.program, roboEyesPreset.model, 300)
    expect(first.phase).toBe('transition')
    expect(first.model.gaze.x).toBeGreaterThan(0)
    expect(first.model.gaze.x).toBeLessThanOrEqual(12)
    expect(second).toEqual(first)
  })

  it('uses the same Spring program/runtime path in editor preview and keeps reduced-motion authoring data intact', () => {
    const programDefaults: PresetAnimationDefaults = {
      version: 1,
      program: springProgram,
    }
    const programFrame = evaluateEditorAnimationFrame(roboEyesPreset.model, programDefaults, { timeMs: 300 })
    const programSample = sampleAnimationProgram(springProgram, roboEyesPreset.model, 300).model
    expect(programFrame).toEqual(programSample)

    const definitionDefaults: PresetAnimationDefaults = {
      version: 1,
      definition: springDefinition,
    }
    const animated = evaluateEditorAnimationFrame(roboEyesPreset.model, definitionDefaults, { timeMs: 300 })
    expect(animated.gaze.x).toBeGreaterThan(0)

    const reduced = evaluateEditorAnimationFrame(roboEyesPreset.model, definitionDefaults, {
      timeMs: 300,
      reducedMotion: true,
    })
    expect(reduced.gaze).toEqual(roboEyesPreset.model.gaze)
    expect(definitionDefaults.definition).toEqual(springDefinition)
  })
})
