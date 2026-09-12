import { describe, expect, it } from 'vitest'
import { normalizePresetAnimationDefaults } from '../../../animation'

describe('Variant B MotionDeckCard safety', () => {
  it('allows auto-blink enabled configuration without throwing assertAllowedKeys error', () => {
    const rawDefaults = {
      version: 1 as const,
      definition: {
        version: 1 as const,
        enabled: true,
        channels: {
          'eye-openness': {
            kind: 'eye-openness' as const,
            autoBlink: {
              enabled: true,
              intervalMs: 2500,
              variationMs: 1500,
            },
          },
        },
      },
    }

    expect(() => normalizePresetAnimationDefaults(rawDefaults)).not.toThrow()
    const normalized = normalizePresetAnimationDefaults(rawDefaults)
    expect(normalized.definition?.channels?.['eye-openness']).toBeDefined()
  })

  it('allows idle-gaze enabled configuration without throwing assertAllowedKeys error', () => {
    const rawDefaults = {
      version: 1 as const,
      definition: {
        version: 1 as const,
        enabled: true,
        channels: {
          'gaze-pose': {
            kind: 'idle-gaze' as const,
            enabled: true,
            intervalMs: 2000,
            variationMs: 2500,
            transitionDurationMs: 300,
          },
        },
      },
    }

    expect(() => normalizePresetAnimationDefaults(rawDefaults)).not.toThrow()
    const normalized = normalizePresetAnimationDefaults(rawDefaults)
    expect(normalized.definition?.channels?.['gaze-pose']).toBeDefined()
  })
})
