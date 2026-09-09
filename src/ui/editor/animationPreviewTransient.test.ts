import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../../core/presets'
import type { PresetAnimationDefaults } from '../../animation'
import { evaluateEditorAnimationPreviewFrame, nextRuntimeEvent } from './animationPreview'

const defaults: PresetAnimationDefaults = {
  version: 1,
  seed: 17,
  definition: {
    version: 1,
    enabled: true,
    channels: {
      'transient-effect': {
        kind: 'transient-effect-layer',
        effects: [{
          kind: 'sweat',
          id: 'sweat:preview',
          enabled: true,
          dropCount: 3,
          minTargetY: 12,
          maxTargetY: 12,
        }],
      },
    },
  },
}

describe('editor transient effect preview composition', () => {
  it('returns transient overlays separately from the resolved FaceModel', () => {
    const base = structuredClone(roboEyesPreset.model)
    const before = structuredClone(base)
    const frame = evaluateEditorAnimationPreviewFrame(base, defaults, { timeMs: 200 })

    expect(frame.model).toEqual(base)
    expect(frame.transientEffects.overlays).toHaveLength(3)
    expect(base).toEqual(before)
  })

  it('suppresses authored ambient transient motion for reduced motion', () => {
    const frame = evaluateEditorAnimationPreviewFrame(roboEyesPreset.model, defaults, {
      timeMs: 200,
      reducedMotion: true,
    })
    expect(frame.transientEffects.overlays).toHaveLength(0)
  })

  it('still permits an explicit transient runtime trigger under reduced motion', () => {
    const event = nextRuntimeEvent('sweat-enable', 'transient-effect', 100, 0)
    const frame = evaluateEditorAnimationPreviewFrame(roboEyesPreset.model, {}, {
      timeMs: 100,
      reducedMotion: true,
      runtimeEvents: [event],
    })
    expect(frame.transientEffects.overlays).toHaveLength(3)
    expect(frame.transientEffects.overlays.every((overlay) => overlay.y === 2)).toBe(true)
  })
})
