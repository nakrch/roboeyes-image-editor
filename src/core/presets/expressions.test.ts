import { describe, expect, it } from 'vitest'
import { areEyeLidAperturesValid, resolveEyeExpression } from '../model'
import { expressionPresets, matchExpressionPreset } from './expressions'

describe('expression presets', () => {
  it('provides parametric core, curious, and derivative-inspired expressions', () => {
    expect(expressionPresets.map((preset) => preset.name)).toEqual(
      expect.arrayContaining([
        'Happy',
        'Angry',
        'Tired',
        'Curious',
        'Surprised',
        'Sad',
        'Suspicious',
        'Serious',
        'Irritated',
      ]),
    )
    for (const preset of expressionPresets) {
      expect(typeof preset.expression.upperLid).toBe('number')
      expect(typeof preset.expression.lowerLid).toBe('number')
      expect(typeof preset.expression.tilt).toBe('number')
      expect(areEyeLidAperturesValid(preset.expression)).toBe(true)
    }
  })

  it('uses original RoboEyes mask orientation for tired and angry', () => {
    const angry = expressionPresets.find((preset) => preset.name === 'Angry')!
    const tired = expressionPresets.find((preset) => preset.name === 'Tired')!

    expect(angry.expression).toMatchObject({ upperLidInner: 0.5, upperLidOuter: 0, tilt: 0 })
    expect(tired.expression).toMatchObject({ upperLidInner: 0, upperLidOuter: 0.5, tilt: 0 })
  })

  it('builds happy from a rounded lower mask without whole-eye tilt', () => {
    const happy = expressionPresets.find((preset) => preset.name === 'Happy')!
    expect(happy.expression.tilt).toBe(0)
    expect(happy.expression.lowerLid).toBeGreaterThan(0)
    expect(happy.expression.lowerLidCurvature).toBeGreaterThan(0)
  })

  it('defines Curious as generic gaze-reactive height parameters', () => {
    const curious = expressionPresets.find((preset) => preset.name === 'Curious')!
    expect(curious.expression.gazeHeightExpansion).toBeGreaterThan(0)
    expect(curious.expression.gazeHeightThreshold).toBeGreaterThan(0)
    expect(curious.expression.leftEye).toBeUndefined()
    expect(curious.expression.rightEye).toBeUndefined()
  })

  it('uses generic directional lids and asymmetry for the extended static vocabulary', () => {
    const sad = expressionPresets.find((preset) => preset.name === 'Sad')!
    const suspicious = expressionPresets.find((preset) => preset.name === 'Suspicious')!
    const serious = expressionPresets.find((preset) => preset.name === 'Serious')!
    const irritated = expressionPresets.find((preset) => preset.name === 'Irritated')!

    expect(sad.expression.upperLidOuter).toBeGreaterThan(0)
    expect(sad.expression.tilt).toBeGreaterThan(0)

    const suspiciousLeft = resolveEyeExpression(suspicious.expression, 'left')
    const suspiciousRight = resolveEyeExpression(suspicious.expression, 'right')
    expect(suspiciousLeft.upperLid).not.toBe(suspiciousRight.upperLid)
    expect(suspiciousLeft.heightScale).not.toBe(suspiciousRight.heightScale)

    expect(serious.expression.upperLid).toBeGreaterThan(0)
    expect(serious.expression.leftEye).toBeUndefined()
    expect(irritated.expression.upperLidInner).toBeGreaterThan(irritated.expression.upperLidOuter ?? 0)
    expect(irritated.expression.tilt).toBeLessThan(0)
  })

  it('recognizes exact presets and generic extension parameters participate in matching', () => {
    const happy = expressionPresets.find((preset) => preset.name === 'Happy')!
    const angry = expressionPresets.find((preset) => preset.name === 'Angry')!
    const curious = expressionPresets.find((preset) => preset.name === 'Curious')!
    const suspicious = expressionPresets.find((preset) => preset.name === 'Suspicious')!
    expect(matchExpressionPreset(happy.expression)).toBe(happy.id)
    expect(matchExpressionPreset(angry.expression)).toBe(angry.id)
    expect(matchExpressionPreset(curious.expression)).toBe(curious.id)
    expect(matchExpressionPreset(suspicious.expression)).toBe(suspicious.id)
    expect(matchExpressionPreset({ ...happy.expression, lowerLidCurvature: 0.1 })).toBe('custom')
    expect(matchExpressionPreset({ ...angry.expression, upperLidInner: 0.25 })).toBe('custom')
    expect(matchExpressionPreset({ ...curious.expression, gazeHeightExpansion: 0.1 })).toBe('custom')
    expect(matchExpressionPreset({ ...happy.expression, leftEye: { upperLid: 0.7 } })).toBe('custom')
    expect(matchExpressionPreset({
      ...suspicious.expression,
      leftEye: { ...suspicious.expression.leftEye, heightScale: 0.7 },
    })).toBe('custom')
  })

  it('matches semantically equivalent explicit per-eye overrides', () => {
    const serious = expressionPresets.find((preset) => preset.name === 'Serious')!
    expect(matchExpressionPreset({
      ...serious.expression,
      leftEye: { upperLid: 0.18, lowerLid: 0.08, tilt: 0, heightScale: 0.9 },
    })).toBe(serious.id)
  })

  it('keeps Neutral and Surprised distinct', () => {
    const neutral = expressionPresets.find((preset) => preset.name === 'Neutral')!
    const surprised = expressionPresets.find((preset) => preset.name === 'Surprised')!
    expect(surprised.expression).not.toEqual(neutral.expression)
    expect((surprised.expression.heightScale ?? 1)).toBeGreaterThan(neutral.expression.heightScale ?? 1)
    expect(matchExpressionPreset(neutral.expression)).toBe('expression:neutral')
    expect(matchExpressionPreset(surprised.expression)).toBe('expression:surprised')
  })
})
