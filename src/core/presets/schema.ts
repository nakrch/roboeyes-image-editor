import type { FaceModel } from '../model'

export type NumericConstraint = {
  min?: number
  max?: number
  step?: number
}

export type PresetConstraints = Record<string, NumericConstraint>

export type FacePreset = {
  /** Stable preset identifier. Built-ins use namespaced IDs such as builtin:roboeyes. */
  id: string
  name: string
  version: 1
  model: FaceModel
  constraints: PresetConstraints
  /** Reserved for future state/transition defaults without coupling the static model to animation. */
  animationDefaults: Record<string, unknown>
  preview?: {
    transparentBackground?: boolean
  }
}

export function isFacePreset(value: unknown): value is FacePreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Partial<FacePreset>
  const model = preset.model as Partial<FaceModel> | undefined

  return Boolean(
    typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      preset.version === 1 &&
      model &&
      typeof model.canvas?.width === 'number' &&
      typeof model.canvas?.height === 'number' &&
      model.leftEye?.geometry &&
      model.rightEye?.geometry &&
      model.gaze &&
      model.expression &&
      model.colors &&
      preset.constraints &&
      typeof preset.constraints === 'object' &&
      preset.animationDefaults &&
      typeof preset.animationDefaults === 'object',
  )
}

export function clonePreset(preset: FacePreset): FacePreset {
  return structuredClone(preset)
}
