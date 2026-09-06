import type { FaceModel } from '../model'
import { isFacePreset, type FacePreset } from './schema'

export const CUSTOM_PRESET_STORAGE_KEY = 'roboeyes-image-editor.custom-presets.v1'

function highestPresetNameSuffix(base: string, presets: readonly { name: string }[]): number {
  let highest = 0
  const prefix = `${base} `

  for (const preset of presets) {
    if (!preset.name.startsWith(prefix)) continue
    const suffix = preset.name.slice(prefix.length)
    if (!/^\d+$/.test(suffix)) continue
    highest = Math.max(highest, Number(suffix))
  }

  return highest
}

export function uniquePresetName(
  requestedName: string,
  presets: readonly { name: string }[],
): string {
  const names = new Set(presets.map((preset) => preset.name))
  const trimmed = requestedName.trim()
  const base = trimmed || 'Custom preset'
  const baseAlreadyExists = names.has(base)

  if (trimmed && !baseAlreadyExists) return base

  const suffix = highestPresetNameSuffix(base, presets) + 1
  return `${base} ${suffix}`
}

export function nextCustomPresetName(presets: readonly { name: string }[]): string {
  return uniquePresetName('', presets)
}

export function createCustomPreset(
  name: string,
  model: FaceModel,
  transparentBackground = false,
  existingPresets: readonly { name: string }[] = [],
): FacePreset {
  return {
    id: `custom:${crypto.randomUUID()}`,
    name: uniquePresetName(name, existingPresets),
    version: 1,
    model: structuredClone(model),
    constraints: {},
    animationDefaults: {},
    preview: { transparentBackground },
  }
}

export function removeCustomPreset(presets: readonly FacePreset[], id: string): FacePreset[] {
  return presets.filter((preset) => preset.id !== id)
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
