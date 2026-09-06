import { describe, expect, it } from 'vitest'
import { minimalPreset } from './minimal'
import {
  CUSTOM_EXPRESSION_PRESET_STORAGE_KEY,
  applyExpressionPresetToModel,
  createUserExpressionPreset,
  loadCustomExpressionPresets,
  nextCustomExpressionName,
  parseExpressionPreset,
  removeUserExpressionPreset,
  saveCustomExpressionPresets,
  serializeExpressionPreset,
  uniqueExpressionPresetName,
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

  it('assigns the first available sequential default name when the user leaves the name blank', () => {
    const existing: UserExpressionPreset[] = [
      { ...asymmetricPreset, id: 'expression-custom:1', name: 'Custom expression 1' },
      { ...asymmetricPreset, id: 'expression-custom:3', name: 'Custom expression 3' },
    ]
    expect(nextCustomExpressionName(existing)).toBe('Custom expression 2')
    expect(createUserExpressionPreset('   ', asymmetricPreset.expression, existing).name).toBe('Custom expression 2')
  })

  it('keeps a requested name when it is unused and appends sequential suffixes when duplicated', () => {
    const existing = [
      { name: 'Sleepy' },
      { name: 'Sleepy 1' },
      { name: 'Sleepy 3' },
      { name: 'Happy' },
    ]

    expect(uniqueExpressionPresetName('Fresh', existing)).toBe('Fresh')
    expect(uniqueExpressionPresetName('Sleepy', existing)).toBe('Sleepy 2')
    expect(uniqueExpressionPresetName('Happy', existing)).toBe('Happy 1')
  })

  it('removes only the requested custom expression preset', () => {
    const other = { ...asymmetricPreset, id: 'expression-custom:other', name: 'Other' }
    expect(removeUserExpressionPreset([asymmetricPreset, other], asymmetricPreset.id)).toEqual([other])
  })
})
