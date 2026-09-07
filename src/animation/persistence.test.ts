import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../core/presets'
import {
  createCustomPreset,
  parsePreset,
  serializePreset,
} from '../core/presets/storage'
import {
  defaultBehaviorProfile,
  evaluateBehaviorProfileFrame,
} from './behaviorProfiles'
import {
  initializePresetAnimation,
  isPresetAnimationDefaults,
  normalizePersistedAnimationDefinition,
  normalizePresetAnimationDefaults,
  type PresetAnimationDefaultsV1,
} from './persistence'
import { createAnimationFrameContext } from './runtime'

const program = {
  version: 1 as const,
  id: 'program:persisted',
  name: 'Persisted program',
  playbackMode: 'loop' as const,
  steps: [
    {
      id: 'left',
      target: { gaze: { x: -8, y: 0 } },
      transitionDurationMs: 120,
      easing: 'ease-in-out' as const,
      holdDurationMs: 300,
      actions: [{
        id: 'blink',
        channel: 'eye-openness' as const,
        action: 'blink',
        offsetMs: 100,
      }],
    },
    {
      id: 'right',
      target: { gaze: { x: 8, y: 0 } },
      transitionDurationMs: 120,
      easing: 'ease-in-out' as const,
      holdDurationMs: 300,
    },
  ],
}

const fullDefaults: PresetAnimationDefaultsV1 = {
  version: 1,
  seed: 0x1234abcd,
  definition: {
    version: 1,
    enabled: true,
    channels: {
      'eye-openness': {
        kind: 'eye-openness',
        autoBlink: { enabled: true, intervalMs: 2_000, variationMs: 500 },
      },
    },
  },
  behaviorProfile: defaultBehaviorProfile,
  program,
}

describe('preset animation defaults schema', () => {
  it('keeps legacy empty animationDefaults unchanged and initializes disabled deterministic runtime input', () => {
    expect(normalizePresetAnimationDefaults({})).toEqual({})
    expect(isPresetAnimationDefaults({})).toBe(true)
    expect(initializePresetAnimation({})).toEqual({
      seed: 0,
      definition: { version: 1, enabled: false },
    })
  })

  it('round-trips seed, behavior profile, program identities, timing, and easing as JSON-safe data', () => {
    const normalized = normalizePresetAnimationDefaults(fullDefaults)
    const roundTrip = normalizePresetAnimationDefaults(JSON.parse(JSON.stringify(normalized)))
    expect(roundTrip).toEqual(normalized)
    expect(roundTrip.version).toBe(1)
    if (roundTrip.version !== 1) throw new Error('Expected v1 animation defaults')
    expect(roundTrip.seed).toBe(0x1234abcd)
    expect(roundTrip.behaviorProfile?.id).toBe('behavior:default')
    expect(roundTrip.program?.id).toBe('program:persisted')
    expect(roundTrip.program?.steps.map((step) => step.id)).toEqual(['left', 'right'])
    expect(roundTrip.program?.steps[0].actions?.[0].id).toBe('blink')
    expect(roundTrip.program?.steps[0].transitionDurationMs).toBe(120)
    expect(roundTrip.program?.steps[0].easing).toBe('ease-in-out')
  })

  it('preserves stable program/step/action identities through reorder and another JSON round trip', () => {
    const normalized = normalizePresetAnimationDefaults(fullDefaults)
    if (normalized.version !== 1 || normalized.program === undefined) throw new Error('Expected persisted program')
    const reordered = {
      ...normalized,
      program: {
        ...normalized.program,
        steps: [...normalized.program.steps].reverse(),
      },
    }
    const roundTrip = normalizePresetAnimationDefaults(JSON.parse(JSON.stringify(reordered)))
    if (roundTrip.version !== 1) throw new Error('Expected v1 animation defaults')
    expect(roundTrip.program?.steps.map((step) => step.id)).toEqual(['right', 'left'])
    expect(roundTrip.program?.steps[1].actions?.[0].id).toBe('blink')
  })

  it('rejects unsupported versions, unknown fields, non-finite seeds, and runtime-only state', () => {
    expect(() => normalizePresetAnimationDefaults({ version: 2 })).toThrow(/Unsupported preset/)
    expect(() => normalizePresetAnimationDefaults({ version: 1, positionMs: 400 })).toThrow(/unsupported field/)
    expect(() => normalizePresetAnimationDefaults({ version: 1, randomCursor: 7 })).toThrow(/unsupported field/)
    expect(() => normalizePresetAnimationDefaults({ version: 1, seed: Number.NaN })).toThrow(/Animation seed/)
  })

  it('rejects unsupported channel fields and runtime retarget snapshots instead of silently accepting them', () => {
    expect(() => normalizePersistedAnimationDefinition({
      version: 1,
      enabled: true,
      channels: {
        'eye-openness': { kind: 'eye-openness', hiddenRuntimeProgress: 0.5 },
      },
    })).toThrow(/unsupported field/)

    expect(() => normalizePersistedAnimationDefinition({
      version: 1,
      enabled: true,
      channels: {
        'state-transition': {
          kind: 'face-model-transition',
          id: 'retargeted',
          startTimeMs: 0,
          durationMs: 100,
          easing: 'linear',
          target: { gaze: { x: 2 } },
          from: roboEyesPreset.model,
        },
      },
    })).toThrow(/unsupported field: from/)

    expect(() => normalizePersistedAnimationDefinition({
      version: 1,
      enabled: true,
      channels: { 'transient-effect': { kind: 'future-effect' } },
    })).toThrow(/not supported/)
  })

  it('rejects unknown fields nested inside sequence state targets', () => {
    expect(() => normalizePresetAnimationDefaults({
      version: 1,
      program: {
        version: 1,
        id: 'bad-target',
        playbackMode: 'once',
        steps: [{
          id: 'step',
          target: { gaze: { x: 0, secret: 1 } },
          transitionDurationMs: 0,
          easing: 'linear',
          holdDurationMs: 10,
        }],
      },
    })).toThrow(/unsupported field: secret/)
  })
})

describe('face preset integration', () => {
  it('round-trips authored animation defaults through face preset JSON import/export', () => {
    const preset = {
      ...roboEyesPreset,
      id: 'custom:persistence-test',
      name: 'Persistence test',
      animationDefaults: fullDefaults,
    }
    const parsed = parsePreset(serializePreset(preset))
    expect(parsed).toEqual({
      ...preset,
      animationDefaults: normalizePresetAnimationDefaults(fullDefaults),
    })
  })

  it('lets custom preset creation preserve current authored animation defaults without changing old callers', () => {
    const legacy = createCustomPreset('Legacy', roboEyesPreset.model)
    expect(legacy.animationDefaults).toEqual({})

    const animated = createCustomPreset('Animated', roboEyesPreset.model, false, [], fullDefaults)
    expect(animated.animationDefaults).toEqual(normalizePresetAnimationDefaults(fullDefaults))
    expect(animated.model).toEqual(roboEyesPreset.model)
  })

  it('initializes identical deterministic behavior from the authored seed without mutating static model fields', () => {
    const initializedA = initializePresetAnimation(fullDefaults)
    const initializedB = initializePresetAnimation(JSON.parse(JSON.stringify(fullDefaults)))
    expect(initializedB).toEqual(initializedA)
    expect(initializedA.seed).toBe(0x1234abcd)
    expect(initializedA).not.toHaveProperty('positionMs')
    expect(initializedA).not.toHaveProperty('runtimeEvents')
    expect(initializedA).not.toHaveProperty('randomCursor')

    if (initializedA.behaviorProfile === undefined) throw new Error('Expected behavior profile')
    const before = structuredClone(roboEyesPreset.model)
    const frameA = evaluateBehaviorProfileFrame(
      initializedA.behaviorProfile,
      roboEyesPreset.model,
      createAnimationFrameContext(750, initializedA.seed),
    )
    const frameB = evaluateBehaviorProfileFrame(
      initializedA.behaviorProfile,
      roboEyesPreset.model,
      createAnimationFrameContext(750, initializedA.seed),
    )
    expect(frameB).toEqual(frameA)
    expect(roboEyesPreset.model).toEqual(before)
  })
})
