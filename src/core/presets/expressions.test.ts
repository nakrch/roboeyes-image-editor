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
})
