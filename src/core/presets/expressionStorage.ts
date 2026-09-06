import type { ExpressionModel, EyeExpression, FaceModel } from '../model'

export type UserExpressionPreset = {
  id: string
  name: string
  version: 1
  expression: ExpressionModel
}

export const CUSTOM_EXPRESSION_PRESET_STORAGE_KEY = 'roboeyes-image-editor.expression-presets.v1'

const numericKeys: readonly (keyof EyeExpression)[] = [
  'upperLid',
  'upperLidInner',
  'upperLidOuter',
  'lowerLid',
  'lowerLidCurvature',
  'tilt',
  'heightScale',
  'gazeHeightExpansion',
  'gazeHeightThreshold',
]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isEyeExpression(value: unknown, partial: boolean): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const allowed = new Set(numericKeys)
  if (Object.keys(record).some((key) => !allowed.has(key as keyof EyeExpression))) return false
  if (!partial && (!isFiniteNumber(record.upperLid) || !isFiniteNumber(record.lowerLid) || !isFiniteNumber(record.tilt))) return false
  return Object.entries(record).every(([, item]) => isFiniteNumber(item))
}

export function isExpressionModel(value: unknown): value is ExpressionModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const base = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'leftEye' && key !== 'rightEye'))
  if (!isEyeExpression(base, false)) return false
  if (record.leftEye !== undefined && !isEyeExpression(record.leftEye, true)) return false
  if (record.rightEye !== undefined && !isEyeExpression(record.rightEye, true)) return false
  return true
}

export function isUserExpressionPreset(value: unknown): value is UserExpressionPreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Partial<UserExpressionPreset>
  return typeof preset.id === 'string' && typeof preset.name === 'string' && preset.version === 1 && isExpressionModel(preset.expression)
}

export function nextCustomExpressionName(presets: readonly UserExpressionPreset[]): string {
  let highest = 0
  for (const preset of presets) {
    const match = /^Custom expression (\d+)$/.exec(preset.name)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `Custom expression ${highest + 1}`
}

export function createUserExpressionPreset(name: string, expression: ExpressionModel, existingPresets: readonly UserExpressionPreset[] = []): UserExpressionPreset {
  return {
    id: `expression-custom:${crypto.randomUUID()}`,
    name: name.trim() || nextCustomExpressionName(existingPresets),
    version: 1,
    expression: structuredClone(expression),
  }
}

export function removeUserExpressionPreset(presets: readonly UserExpressionPreset[], id: string): UserExpressionPreset[] {
  return presets.filter((preset) => preset.id !== id)
}

export function applyExpressionPresetToModel(model: FaceModel, preset: Pick<UserExpressionPreset, 'expression'>): FaceModel {
  return {
    ...model,
    expression: structuredClone(preset.expression),
  }
}

export function serializeExpressionPreset(preset: UserExpressionPreset): string {
  return JSON.stringify(preset, null, 2)
}

export function parseExpressionPreset(json: string): UserExpressionPreset {
  const parsed: unknown = JSON.parse(json)
  if (!isUserExpressionPreset(parsed)) throw new Error('Invalid expression preset JSON')
  return parsed
}

export function loadCustomExpressionPresets(storage: Pick<Storage, 'getItem'>): UserExpressionPreset[] {
  const raw = storage.getItem(CUSTOM_EXPRESSION_PRESET_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isUserExpressionPreset) : []
  } catch {
    return []
  }
}

export function saveCustomExpressionPresets(storage: Pick<Storage, 'setItem'>, presets: UserExpressionPreset[]): void {
  storage.setItem(CUSTOM_EXPRESSION_PRESET_STORAGE_KEY, JSON.stringify(presets))
}
