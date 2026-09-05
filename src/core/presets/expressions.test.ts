import { describe, expect, it } from 'vitest'
import { expressionPresets, matchExpressionPreset } from './expressions'

describe('expression presets', () => {
  it('provides parametric happy, angry, tired, and surprised expressions', () => {
    expect(expressionPresets.map((preset) => preset.name)).toEqual(
      expect.arrayContaining(['Happy', 'Angry', 'Tired', 'Surprised']),
    )
    for (const preset of expressionPresets) {
      expect(typeof preset.expression.upperLid).toBe('number')
      expect(typeof preset.expression.lowerLid).toBe('number')
      expect(typeof preset.expression.tilt).toBe('number')
    }
  })

  it('recognizes exact presets and treats per-eye overrides as custom', () => {
    const happy = expressionPresets.find((preset) => preset.name === 'Happy')!
    expect(matchExpressionPreset(happy.expression)).toBe(happy.id)
    expect(matchExpressionPreset({ ...happy.expression, leftEye: { upperLid: 0.7 } })).toBe('custom')
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
