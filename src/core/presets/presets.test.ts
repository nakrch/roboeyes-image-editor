import { describe, expect, it } from 'vitest'
import { minimalPreset } from './minimal'
import { roboEyesPreset } from './roboeyes'
import {
  CUSTOM_PRESET_STORAGE_KEY,
  createCustomPreset,
  loadCustomPresets,
  nextCustomPresetName,
  parsePreset,
  removeCustomPreset,
  saveCustomPresets,
  serializePreset,
  uniquePresetName,
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

  it('assigns monotonic default names from the highest existing suffix', () => {
    const existing = [
      { name: 'Custom preset 1' },
      { name: 'Custom preset 4' },
    ]

    expect(nextCustomPresetName(existing)).toBe('Custom preset 5')
    expect(createCustomPreset('', minimalPreset.model, false, existing).name).toBe('Custom preset 5')
  })

  it('keeps unused names and increments duplicate names from the highest suffix', () => {
    const existing = [
      { name: 'RoboEyes' },
      { name: 'RoboEyes 1' },
      { name: 'RoboEyes 4' },
      { name: 'Minimal' },
    ]

    expect(uniquePresetName('Fresh', existing)).toBe('Fresh')
    expect(uniquePresetName('RoboEyes', existing)).toBe('RoboEyes 5')
    expect(uniquePresetName('Minimal', existing)).toBe('Minimal 1')
  })

  it('removes only the requested custom preset', () => {
    const first = { ...minimalPreset, id: 'custom:first', name: 'First' }
    const second = { ...minimalPreset, id: 'custom:second', name: 'Second' }
    expect(removeCustomPreset([first, second], first.id)).toEqual([second])
  })
})
