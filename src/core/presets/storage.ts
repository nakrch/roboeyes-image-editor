import {
  normalizePresetAnimationDefaults,
  type PresetAnimationDefaults,
} from '../../animation/persistence'
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
  animationDefaults: PresetAnimationDefaults = {},
): FacePreset {
  return {
    id: `custom:${crypto.randomUUID()}`,
    name: uniquePresetName(name, existingPresets),
    version: 1,
    model: structuredClone(model),
    constraints: {},
    animationDefaults: normalizePresetAnimationDefaults(animationDefaults),
    preview: { transparentBackground },
  }
}

export function removeCustomPreset(presets: readonly FacePreset[], id: string): FacePreset[] {
  return presets.filter((preset) => preset.id !== id)
}

function normalizePresetAuthoringData(value: unknown): FacePreset {
  if (!isFacePreset(value)) throw new Error('Invalid preset JSON')
  try {
    return {
      ...structuredClone(value),
      animationDefaults: normalizePresetAnimationDefaults(value.animationDefaults),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid preset animationDefaults: ${message}`)
  }
}

export function serializePreset(preset: FacePreset): string {
  return JSON.stringify(normalizePresetAuthoringData(preset), null, 2)
}

export function parsePreset(json: string): FacePreset {
  const parsed: unknown = JSON.parse(json)
  return normalizePresetAuthoringData(parsed)
}

export function loadCustomPresets(storage: Pick<Storage, 'getItem'>): FacePreset[] {
  const raw = storage.getItem(CUSTOM_PRESET_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const presets: FacePreset[] = []
    for (const value of parsed) {
      try {
        presets.push(normalizePresetAuthoringData(value))
      } catch {
        // Preserve prior storage behavior: invalid individual entries are skipped.
      }
    }
    return presets
  } catch {
    return []
  }
}

export function saveCustomPresets(
  storage: Pick<Storage, 'setItem'>,
  presets: FacePreset[],
): void {
  const normalized = presets.map(normalizePresetAuthoringData)
  storage.setItem(CUSTOM_PRESET_STORAGE_KEY, JSON.stringify(normalized))
}
