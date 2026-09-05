export { minimalPreset } from './minimal'
export { defaultRoboEyesPreset, roboEyesPreset } from './roboeyes'
export { expressionPresets, matchExpressionPreset } from './expressions'
export type { ExpressionPreset } from './expressions'
export {
  CUSTOM_PRESET_STORAGE_KEY,
  createCustomPreset,
  loadCustomPresets,
  parsePreset,
  saveCustomPresets,
  serializePreset,
} from './storage'
export { clonePreset, isFacePreset } from './schema'
export type { FacePreset, NumericConstraint, PresetConstraints } from './schema'

import { minimalPreset } from './minimal'
import { roboEyesPreset } from './roboeyes'

export const builtInPresets = [roboEyesPreset, minimalPreset] as const
