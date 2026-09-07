import { describe, expect, it } from 'vitest'
import { roboEyesPreset } from '../../core/presets'
import { curiousBehaviorProfile, type PresetAnimationDefaults } from '../../animation'
import { editableAnimationDefaults, evaluateEditorAnimationFrame, nextRuntimeEvent } from './animationPreview'

describe('editor animation preview composition', () => {
  it('keeps legacy empty defaults static until authoring data is changed', () => {
    const base = roboEyesPreset.model
    const frame = evaluateEditorAnimationFrame(base, {}, { timeMs: 10_000 })
    expect(frame).toEqual(base)

    const editable = editableAnimationDefaults({})
    expect(editable.version).toBe(1)
    expect(editable.seed).toBe(0)
    expect(editable.definition?.enabled).toBe(false)
  })

  it('combines a behavior profile with the authored base expression without mutating it', () => {
    const base = structuredClone(roboEyesPreset.model)
    const before = structuredClone(base.expression)
    const defaults: PresetAnimationDefaults = {
      version: 1,
      seed: 17,
      behaviorProfile: structuredClone(curiousBehaviorProfile),
    }
    const frame = evaluateEditorAnimationFrame(base, defaults, { timeMs: 800 })
    expect(frame.expression).toEqual(before)
    expect(base.expression).toEqual(before)
    expect(frame.gaze).not.toEqual(base.gaze)
  })

  it('suppresses ambient motion for reduced motion while preserving direct triggers', () => {
    const base = structuredClone(roboEyesPreset.model)
    const defaults: PresetAnimationDefaults = {
      version: 1,
      seed: 3,
      behaviorProfile: structuredClone(curiousBehaviorProfile),
    }
    const reduced = evaluateEditorAnimationFrame(base, defaults, {
      timeMs: 800,
      reducedMotion: true,
    })
    expect(reduced).toEqual(base)

    const blink = nextRuntimeEvent('blink', 'eye-openness', 0, 0)
    const direct = evaluateEditorAnimationFrame(base, defaults, {
      timeMs: 80,
      reducedMotion: true,
      runtimeEvents: [blink],
    })
    expect(direct.leftEye.geometry.height).toBeLessThan(base.leftEye.geometry.height)
    expect(direct.rightEye.geometry.height).toBeLessThan(base.rightEye.geometry.height)
  })

  it('samples sequence state before ambient/runtime channels and remains seekable', () => {
    const base = structuredClone(roboEyesPreset.model)
    const defaults: PresetAnimationDefaults = {
      version: 1,
      seed: 1,
      program: {
        version: 1,
        id: 'animation:test-ui',
        playbackMode: 'once',
        steps: [
          {
            id: 'step:one',
            target: { gaze: { x: 0, y: 0 } },
            transitionDurationMs: 0,
            easing: 'linear',
            holdDurationMs: 100,
          },
          {
            id: 'step:two',
            target: { gaze: { x: 12, y: 0 } },
            transitionDurationMs: 100,
            easing: 'linear',
            holdDurationMs: 100,
          },
        ],
      },
    }

    const late = evaluateEditorAnimationFrame(base, defaults, { timeMs: 150 })
    const early = evaluateEditorAnimationFrame(base, defaults, { timeMs: 50 })
    const lateAgain = evaluateEditorAnimationFrame(base, defaults, { timeMs: 150 })
    expect(early.gaze.x).toBe(0)
    expect(late.gaze.x).toBeGreaterThan(0)
    expect(lateAgain).toEqual(late)
  })
})
