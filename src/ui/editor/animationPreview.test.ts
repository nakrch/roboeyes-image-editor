import { describe, expect, it } from 'vitest'
import { resolveEyeExpression } from '../../core/model'
import { expressionPresets, roboEyesPreset } from '../../core/presets'
import {
  angryBehaviorProfile,
  curiousBehaviorProfile,
  happyBehaviorProfile,
  type PresetAnimationDefaults,
} from '../../animation'
import {
  editableAnimationDefaults,
  evaluateEditorAnimationFrame,
  evaluateEditorAnimationPreviewFrame,
  nextRuntimeEvent,
} from './animationPreview'

function expression(id: string) {
  const found = expressionPresets.find((preset) => preset.id === id)
  if (found === undefined) throw new Error(`Missing expression preset ${id}`)
  return found.expression
}

function expectResolvedExpression(actual: ReturnType<typeof expression>, id: string) {
  const expected = expression(id)
  expect(resolveEyeExpression(actual, 'left')).toEqual(resolveEyeExpression(expected, 'left'))
  expect(resolveEyeExpression(actual, 'right')).toEqual(resolveEyeExpression(expected, 'right'))
}

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

  it('previews a behavior profile recommended expression without mutating the authored base expression', () => {
    const base = structuredClone(roboEyesPreset.model)
    const before = structuredClone(base.expression)
    const defaults: PresetAnimationDefaults = {
      version: 1,
      seed: 17,
      behaviorProfile: structuredClone(curiousBehaviorProfile),
    }
    const frame = evaluateEditorAnimationFrame(base, defaults, { timeMs: 800 })
    expect(frame.expression).toEqual(expression('expression:curious'))
    expect(base.expression).toEqual(before)
    expect(frame.gaze).not.toEqual(base.gaze)
  })

  it('suppresses ambient motion for reduced motion while preserving static profile preview and direct triggers', () => {
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
    expect(reduced.gaze).toEqual(base.gaze)
    expect(reduced.expression).toEqual(expression('expression:curious'))

    const blink = nextRuntimeEvent('blink', 'eye-openness', 0, 0)
    const direct = evaluateEditorAnimationFrame(base, defaults, {
      timeMs: 80,
      reducedMotion: true,
      runtimeEvents: [blink],
    })
    expect(direct.leftEye.geometry.height).toBeLessThan(base.leftEye.geometry.height)
    expect(direct.rightEye.geometry.height).toBeLessThan(base.rightEye.geometry.height)
  })

  it('preserves editor-specific manual trigger payload overrides', () => {
    const event = nextRuntimeEvent('confused', 'motion-offset', 50, 2, {
      amplitude: 6,
      durationMs: 450,
      periodMs: 60,
    })
    expect(event.payload).toEqual({ amplitude: 6, durationMs: 450, periodMs: 60 })
  })

  it('uses a visibly slower sweat cadence in the standard 128x64 editor preview', () => {
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
              id: 'sweat',
              enabled: true,
              startTimeMs: 0,
              dropCount: 3,
              minTargetY: 12,
              maxTargetY: 12,
              fallSpeed: 0.025,
              radius: 3,
            }],
          },
        },
      },
    }

    const afterOldResetTime = evaluateEditorAnimationPreviewFrame(
      roboEyesPreset.model,
      defaults,
      { timeMs: 400 },
    )
    expect(afterOldResetTime.transientEffects.overlays).toHaveLength(3)
    expect(afterOldResetTime.transientEffects.overlays.every((drop) => drop.id.includes('cycle-0'))).toBe(true)
    expect(afterOldResetTime.transientEffects.overlays.every((drop) => drop.y > 2 && drop.y < 12)).toBe(true)

    const reset = evaluateEditorAnimationPreviewFrame(
      roboEyesPreset.model,
      defaults,
      { timeMs: 1_250 },
    )
    expect(reset.transientEffects.overlays.every((drop) => drop.id.includes('cycle-1'))).toBe(true)
  })

  it('keeps behavior active when eye positions move beyond the authored idle wander window', () => {
    const edge = structuredClone(roboEyesPreset.model)
    edge.leftEye.geometry.position.x += 100
    edge.rightEye.geometry.position.x += 100

    const happyDefaults: PresetAnimationDefaults = {
      version: 1,
      seed: 11,
      behaviorProfile: structuredClone(happyBehaviorProfile),
    }
    const happyFrame = evaluateEditorAnimationFrame(edge, happyDefaults, { timeMs: 175 })
    expectResolvedExpression(happyFrame.expression, 'expression:happy')
    expect(happyFrame.leftEye.geometry.position.y).not.toBeCloseTo(edge.leftEye.geometry.position.y)
    expect(happyFrame.rightEye.geometry.position.y).not.toBeCloseTo(edge.rightEye.geometry.position.y)

    const angryFrame = evaluateEditorAnimationFrame(edge, {
      version: 1,
      seed: 11,
      behaviorProfile: structuredClone(angryBehaviorProfile),
    }, { timeMs: 175 })
    expectResolvedExpression(angryFrame.expression, 'expression:angry')

    const centeredAgain = evaluateEditorAnimationFrame(roboEyesPreset.model, happyDefaults, { timeMs: 800 })
    expect(centeredAgain.gaze).not.toEqual(roboEyesPreset.model.gaze)
  })

  it('falls back to a static profile preview instead of crashing when eye geometry is temporarily not animation-safe', () => {
    const base = structuredClone(roboEyesPreset.model)
    base.leftEye.geometry.width = 1_000
    base.rightEye.geometry.width = 1_000

    const defaults: PresetAnimationDefaults = {
      version: 1,
      seed: 9,
      behaviorProfile: structuredClone(curiousBehaviorProfile),
      program: {
        version: 1,
        id: 'animation:unsafe-edit',
        playbackMode: 'loop',
        steps: [
          {
            id: 'step:one',
            target: { expression: structuredClone(expression('expression:happy')) },
            transitionDurationMs: 100,
            easing: 'ease-in-out',
            holdDurationMs: 200,
          },
        ],
      },
    }

    expect(() => evaluateEditorAnimationFrame(base, defaults, { timeMs: 120 })).not.toThrow()
    const frame = evaluateEditorAnimationFrame(base, defaults, { timeMs: 120 })
    expect(frame.leftEye.geometry).toEqual(base.leftEye.geometry)
    expect(frame.rightEye.geometry).toEqual(base.rightEye.geometry)
    expect(frame.expression).toEqual(expression('expression:curious'))
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
