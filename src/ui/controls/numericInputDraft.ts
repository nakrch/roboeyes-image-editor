export type NumericStep = number | 'any'

const MAX_DECIMAL_DIGITS = 2

export function numericPrecisionForStep(step: NumericStep): number {
  return step === 'any' || !Number.isInteger(step) ? MAX_DECIMAL_DIGITS : 0
}

export function roundNumericValue(value: number, precision: number): number {
  const factor = 10 ** precision
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

export function numericControlBounds(
  min: number,
  max: number,
  step: NumericStep,
): { min: number; max: number } {
  const precision = numericPrecisionForStep(step)
  const factor = 10 ** precision
  const lower = Math.ceil((min - Number.EPSILON) * factor) / factor
  const upper = Math.floor((max + Number.EPSILON) * factor) / factor

  if (lower <= upper) return { min: lower, max: upper }

  // Extremely narrow ranges should not normally occur in editor controls. If
  // they do, preserve the original range instead of inventing an unsafe bound.
  return { min, max }
}

export function normalizeNumericControlValue(
  value: number,
  min: number,
  max: number,
  step: NumericStep,
): number {
  const precision = numericPrecisionForStep(step)
  const bounds = numericControlBounds(min, max, step)
  const rounded = roundNumericValue(value, precision)
  const clamped = Math.min(bounds.max, Math.max(bounds.min, rounded))
  return Object.is(clamped, -0) ? 0 : clamped
}

export function formatNumericControlValue(
  value: number,
  min: number,
  max: number,
  step: NumericStep,
): string {
  return String(normalizeNumericControlValue(value, min, max, step))
}

export function resolveNumericDraft(
  draft: string,
  min: number,
  max: number,
  step: NumericStep = 'any',
): number | null {
  const normalized = draft.trim()
  if (normalized === '') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return normalizeNumericControlValue(parsed, min, max, step)
}
