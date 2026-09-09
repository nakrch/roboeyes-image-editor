export type NumberDraft = number | ''

export type ExportNumericDrafts = {
  width: NumberDraft
  height: NumberDraft
  durationMs: NumberDraft
  fps: NumberDraft
  loopCount: NumberDraft
}

export type ExportNumericField = keyof ExportNumericDrafts

export type ExportNumericErrors = Partial<Record<ExportNumericField, string>>

export type ValidStaticExportValues = {
  width: number
  height: number
}

export type ValidAnimatedExportValues = ValidStaticExportValues & {
  durationMs: number
  fps: number
  loopCount: number
}

export type ExportNumericValidation = {
  errors: ExportNumericErrors
  staticValues: ValidStaticExportValues | null
  animatedValues: ValidAnimatedExportValues | null
}

export function parseNumberDraft(value: string): NumberDraft {
  return value === '' ? '' : Number(value)
}

function isFiniteNumber(value: NumberDraft): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateDimension(label: 'Width' | 'Height', value: NumberDraft): string | null {
  if (value === '') return `${label} is required.`
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1) {
    return `${label} must be a whole number of at least 1.`
  }
  return null
}

function validateDuration(value: NumberDraft): string | null {
  if (value === '') return 'Duration is required.'
  if (!isFiniteNumber(value) || value <= 0) return 'Duration must be greater than 0 ms.'
  return null
}

function validateFps(value: NumberDraft): string | null {
  if (value === '') return 'FPS is required.'
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1 || value > 60) {
    return 'FPS must be a whole number from 1 to 60.'
  }
  return null
}

function validateLoopCount(value: NumberDraft): string | null {
  if (value === '') return 'GIF loop count is required.'
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 0 || value > 65535) {
    return 'GIF loop count must be a whole number from 0 to 65535.'
  }
  return null
}

export function validateExportNumericDrafts(drafts: ExportNumericDrafts): ExportNumericValidation {
  const widthError = validateDimension('Width', drafts.width)
  const heightError = validateDimension('Height', drafts.height)
  const durationError = validateDuration(drafts.durationMs)
  const fpsError = validateFps(drafts.fps)
  const loopCountError = validateLoopCount(drafts.loopCount)

  const errors: ExportNumericErrors = {}
  if (widthError !== null) errors.width = widthError
  if (heightError !== null) errors.height = heightError
  if (durationError !== null) errors.durationMs = durationError
  if (fpsError !== null) errors.fps = fpsError
  if (loopCountError !== null) errors.loopCount = loopCountError

  const staticValues = widthError === null && heightError === null
    ? { width: drafts.width as number, height: drafts.height as number }
    : null

  const animatedValues = staticValues !== null && durationError === null && fpsError === null && loopCountError === null
    ? {
        ...staticValues,
        durationMs: drafts.durationMs as number,
        fps: drafts.fps as number,
        loopCount: drafts.loopCount as number,
      }
    : null

  return { errors, staticValues, animatedValues }
}

export function firstStaticValidationError(validation: ExportNumericValidation): string {
  return validation.errors.width ?? validation.errors.height ?? 'Enter valid Width and Height before exporting.'
}

export function firstAnimatedValidationError(validation: ExportNumericValidation): string {
  return validation.errors.width
    ?? validation.errors.height
    ?? validation.errors.durationMs
    ?? validation.errors.fps
    ?? validation.errors.loopCount
    ?? 'Enter valid animation export settings before exporting.'
}
