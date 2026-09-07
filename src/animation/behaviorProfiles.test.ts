import { describe, expect, it } from 'vitest'
import { expressionPresets, roboEyesPreset } from '../core/presets'
import { renderFaceToSvg } from '../renderers/svg'
import {
  angryBehaviorProfile,
  behaviorProfileChannelResolvers,
  builtInBehaviorProfiles,
  confusedBehaviorProfile,
  curiousBehaviorProfile,
  defaultBehaviorProfile,
  evaluateBehaviorProfileFrame,
  findBehaviorProfile,
  frozenBehaviorProfile,
  happyBehaviorProfile,
  normalizeBehaviorProfile,
  scaryBehaviorProfile,
  sleepBehaviorProfile,
} from './behaviorProfiles'
import { createAnimationFrameContext, evaluateAnimationFrame } from './runtime'

function expression(id: string) {
  const found = expressionPresets.find((preset) => preset.id === id)
  if (found === undefined) throw new Error(`Missing expression preset ${id}`)
  return found.expression
}

describe('built-in behavior profile data', () => {
  it('is plain serializable versioned data with unique stable ids', () => {
    const ids = builtInBehaviorProfiles.map((profile) => profile.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'behavior:default',
      'behavior:frozen',
      'behavior:scary',
      'behavior:curious',
      'behavior:happy',
      'behavior:angry',
      'behavior:sleep',
      'behavior:confused',
    ])
    expect(JSON.parse(JSON.stringify(builtInBehaviorProfiles))).toEqual(builtInBehaviorProfiles)
    expect(findBehaviorProfile('behavior:curious')).toBe(curiousBehaviorProfile)
  })

  it('keeps static expression recommendations separate from temporal behavior data', () => {
    expect(frozenBehaviorProfile.recommendedExpressionPresetId).toBe('expression:neutral')
    expect(scaryBehaviorProfile.recommendedExpressionPresetId).toBe('expression:tired')
    expect(curiousBehaviorProfile.recommendedExpressionPresetId).toBe('expression:curious')
    expect(happyBehaviorProfile.recommendedExpressionPresetId).toBe('expression:happy')
    expect(angryBehaviorProfile.recommendedExpressionPresetId).toBe('expression:angry')
    expect(sleepBehaviorProfile.recommendedExpressionPresetId).toBeUndefined()
  })

  it('represents Frozen-like and Scary-like as expression recommendation plus axis shiver', () => {
    expect(frozenBehaviorProfile.animation.channels?.['motion-offset']).toMatchObject({
      kind: 'continuous-motion', axis: 'x', waveform: 'square',
    })
    expect(scaryBehaviorProfile.animation.channels?.['motion-offset']).toMatchObject({
      kind: 'continuous-motion', axis: 'y', waveform: 'square',
    })
  })
})

describe('profile evaluation', () => {
  it('gives Default, Curious, Happy, Angry, Sleep, and Confused distinct temporal definitions', () => {
    const serialized = [
      defaultBehaviorProfile,
      curiousBehaviorProfile,
      happyBehaviorProfile,
      angryBehaviorProfile,
      sleepBehaviorProfile,
      confusedBehaviorProfile,
    ].map((profile) => JSON.stringify(profile.animation))
    expect(new Set(serialized).size).toBe(serialized.length)
  })

  it('runs Frozen-like horizontal and Scary-like vertical motion without changing renderer logic', () => {
    const base = roboEyesPreset.model
    const frozen = evaluateBehaviorProfileFrame(
      frozenBehaviorProfile,
      base,
      createAnimationFrameContext(0, 1),
    )
    const scary = evaluateBehaviorProfileFrame(
      scaryBehaviorProfile,
      base,
      createAnimationFrameContext(0, 1),
    )

    expect(frozen.leftEye.geometry.position.x).not.toBe(base.leftEye.geometry.position.x)
    expect(frozen.leftEye.geometry.position.y).toBe(base.leftEye.geometry.position.y)
    expect(scary.leftEye.geometry.position.x).toBe(base.leftEye.geometry.position.x)
    expect(scary.leftEye.geometry.position.y).not.toBe(base.leftEye.geometry.position.y)
  })

  it('combines Curious static expression with faster deterministic wander without mutating the expression', () => {
    const curiousExpression = structuredClone(expression('expression:curious'))
    const base = { ...roboEyesPreset.model, expression: curiousExpression }
    const before = structuredClone(base.expression)
    const frame = evaluateBehaviorProfileFrame(
      curiousBehaviorProfile,
      base,
      createAnimationFrameContext(500, 17),
    )

    expect(frame.expression).toEqual(before)
    expect(base.expression).toEqual(before)
    expect(frame.gaze).not.toEqual(roboEyesPreset.model.gaze)
  })

  it('keeps Sleep persistently closed through the generic eye-openness primitive', () => {
    const frame = evaluateBehaviorProfileFrame(
      sleepBehaviorProfile,
      roboEyesPreset.model,
      createAnimationFrameContext(20_000, 1),
    )
    expect(frame.leftEye.geometry.height).toBe(0)
    expect(frame.rightEye.geometry.height).toBe(0)
  })

  it('does not mutate built-in expression presets when profiles are applied or removed', () => {
    const before = JSON.stringify(expressionPresets)
    const model = { ...roboEyesPreset.model, expression: expression('expression:happy') }
    evaluateBehaviorProfileFrame(happyBehaviorProfile, model, createAnimationFrameContext(600, 9))
    evaluateBehaviorProfileFrame(defaultBehaviorProfile, model, createAnimationFrameContext(600, 9))
    expect(JSON.stringify(expressionPresets)).toBe(before)
  })

  it('allows a user-authored expression to combine with compatible behavior unchanged', () => {
    const customExpression = {
      upperLid: 0.12,
      lowerLid: 0.08,
      tilt: 3,
      leftEye: { heightScale: 0.9 },
      rightEye: { heightScale: 1.05 },
    }
    const base = { ...roboEyesPreset.model, expression: customExpression }
    const frame = evaluateBehaviorProfileFrame(defaultBehaviorProfile, base, createAnimationFrameContext(700, 5))
    expect(frame.expression).toEqual(customExpression)
    expect(base.expression).toEqual(customExpression)
  })
})

describe('extensibility', () => {
  it('defines and evaluates a new profile entirely as data without renderer changes', () => {
    const custom = normalizeBehaviorProfile({
      id: 'behavior:test-custom',
      name: 'Test Custom',
      version: 1,
      recommendedExpressionPresetId: 'expression:serious',
      animation: {
        version: 1,
        enabled: true,
        channels: {
          'motion-offset': {
            kind: 'continuous-motion', axis: 'y', amplitude: 1.5, periodMs: 240, waveform: 'triangle',
          },
          'eye-openness': {
            kind: 'eye-openness', autoBlink: { enabled: true, intervalMs: 3_000, variationMs: 0 },
          },
        },
      },
    })
    const base = { ...roboEyesPreset.model, expression: expression('expression:serious') }
    const frame = evaluateAnimationFrame({
      baseModel: base,
      definition: custom.animation,
      context: createAnimationFrameContext(60, 22),
      channelResolvers: behaviorProfileChannelResolvers,
    }).model

    expect(frame.expression).toEqual(base.expression)
    expect(frame.leftEye.geometry.position.y).not.toBe(base.leftEye.geometry.position.y)
    expect(renderFaceToSvg(frame)).not.toBe(renderFaceToSvg(base))
  })
})
