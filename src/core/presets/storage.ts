import type { FaceModel } from '../model'
import { isFacePreset, type FacePreset } from './schema'

export const CUSTOM_PRESET_STORAGE_KEY = 'roboeyes-image-editor.custom-presets.v1'

export function createCustomPreset(
  name: string,
  model: FaceModel,
  transparentBackground = false,
): FacePreset {
  return {
    id: `custom:${crypto.randomUUID()}`,
    name: name.trim() || 'Custom preset',
    version: 1,
    model: structuredClone(model),
    constraints: {},
    animationDefaults: {},
    preview: { transparentBackground },
  }
}

export function serializePreset(preset: FacePreset): string {
  return JSON.stringify(preset, null, 2)
}

export function parsePreset(json: string): FacePreset {
  const parsed: unknown = JSON.parse(json)
  if (!isFacePreset(parsed)) throw new Error('Invalid preset JSON')
  return parsed
}

export function loadCustomPresets(storage: Pick<Storage, 'getItem'>): FacePreset[] {
  const raw = storage.getItem(CUSTOM_PRESET_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isFacePreset) : []
  } catch {
    return []
  }
}

export function saveCustomPresets(
  storage: Pick<Storage, 'setItem'>,
  presets: FacePreset[],
): void {
  storage.setItem(CUSTOM_PRESET_STORAGE_KEY, JSON.stringify(presets))
}
