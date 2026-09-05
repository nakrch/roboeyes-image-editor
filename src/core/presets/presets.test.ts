import { describe, expect, it } from 'vitest'
import { minimalPreset } from './minimal'
import { roboEyesPreset } from './roboeyes'
import {
  CUSTOM_PRESET_STORAGE_KEY,
  loadCustomPresets,
  parsePreset,
  saveCustomPresets,
  serializePreset,
} from './storage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  }
}

describe('preset system', () => {
  it('exposes RoboEyes through a generic model and a distinct Minimal style', () => {
    expect(roboEyesPreset.model.canvas).toEqual({ width: 128, height: 64 })
    expect(roboEyesPreset.model.leftEye.geometry.width).toBe(36)
    expect(minimalPreset.model.leftEye.geometry.width).toBe(28)
    expect(minimalPreset.model.leftEye.geometry.height).toBe(18)
    expect(minimalPreset.id).not.toBe(roboEyesPreset.id)
  })

  it('round-trips a preset through JSON', () => {
    const parsed = parsePreset(serializePreset(minimalPreset))
    expect(parsed).toEqual(minimalPreset)
  })

  it('rejects JSON that does not match the preset schema', () => {
    expect(() => parsePreset('{"name":"not enough"}')).toThrow('Invalid preset JSON')
  })

  it('persists and reloads custom presets locally', () => {
    const storage = memoryStorage()
    saveCustomPresets(storage, [minimalPreset])

    expect(storage.values.has(CUSTOM_PRESET_STORAGE_KEY)).toBe(true)
    expect(loadCustomPresets(storage)).toEqual([minimalPreset])
  })
})
