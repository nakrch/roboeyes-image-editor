import { describe, expect, it } from 'vitest'
import { minimalPreset } from './minimal'
import {
  CUSTOM_EXPRESSION_PRESET_STORAGE_KEY,
  applyExpressionPresetToModel,
  loadCustomExpressionPresets,
  parseExpressionPreset,
  saveCustomExpressionPresets,
  serializeExpressionPreset,
  type UserExpressionPreset,
} from './expressionStorage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  }
}

const asymmetricPreset: UserExpressionPreset = {
  id: 'expression-custom:test',
  name: 'Asymmetric test',
  version: 1,
  expression: {
    upperLid: 0.1,
    upperLidInner: 0.2,
    lowerLid: 0.15,
    lowerLidCurvature: 0.4,
    tilt: 3,
    gazeHeightExpansion: 0.25,
    leftEye: { upperLidOuter: 0.5, tilt: -7 },
    rightEye: { lowerLid: 0.35, heightScale: 1.2 },
  },
}

describe('expression preset storage', () => {
  it('round-trips all generic expression fields including asymmetric overrides', () => {
    expect(parseExpressionPreset(serializeExpressionPreset(asymmetricPreset))).toEqual(asymmetricPreset)
  })

  it('persists and reloads expression-only presets independently', () => {
    const storage = memoryStorage()
    saveCustomExpressionPresets(storage, [asymmetricPreset])
    expect(storage.values.has(CUSTOM_EXPRESSION_PRESET_STORAGE_KEY)).toBe(true)
    expect(loadCustomExpressionPresets(storage)).toEqual([asymmetricPreset])
  })

  it('rejects invalid, unsupported, and non-finite expression JSON', () => {
    expect(() => parseExpressionPreset('{"version":2,"id":"x","name":"x","expression":{}}')).toThrow()
    expect(() => parseExpressionPreset(JSON.stringify({ ...asymmetricPreset, expression: { upperLid: 0, lowerLid: 0, tilt: 'bad' } }))).toThrow()
    expect(() => parseExpressionPreset(JSON.stringify({ ...asymmetricPreset, expression: { upperLid: 0, lowerLid: 0, tilt: 0, unknown: 1 } }))).toThrow()
  })

  it('filters invalid stored records instead of failing the whole collection', () => {
    const storage = memoryStorage()
    storage.setItem(CUSTOM_EXPRESSION_PRESET_STORAGE_KEY, JSON.stringify([asymmetricPreset, { version: 99 }]))
    expect(loadCustomExpressionPresets(storage)).toEqual([asymmetricPreset])
  })

  it('applies expression state without changing canvas, eyes, gaze, or colors', () => {
    const model = structuredClone(minimalPreset.model)
    const before = structuredClone(model)
    const next = applyExpressionPresetToModel(model, asymmetricPreset)

    expect(next.expression).toEqual(asymmetricPreset.expression)
    expect(next.canvas).toEqual(before.canvas)
    expect(next.leftEye).toEqual(before.leftEye)
    expect(next.rightEye).toEqual(before.rightEye)
    expect(next.gaze).toEqual(before.gaze)
    expect(next.colors).toEqual(before.colors)
    expect(next).not.toBe(model)
  })
})
