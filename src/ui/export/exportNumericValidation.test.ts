import { describe, expect, it } from 'vitest'
import {
  parseNumberDraft,
  validateExportNumericDrafts,
  type ExportNumericDrafts,
} from './exportNumericValidation'

const validDrafts: ExportNumericDrafts = {
  width: 128,
  height: 64,
  durationMs: 2000,
  fps: 20,
  loopCount: 0,
}

describe('export numeric validation', () => {
  it('keeps an empty input as an explicit draft instead of converting it to a fallback', () => {
    expect(parseNumberDraft('')).toBe('')
    expect(parseNumberDraft('128')).toBe(128)
  })

  it('accepts valid settings and passes their values through unchanged', () => {
    const validation = validateExportNumericDrafts({
      width: 321,
      height: 123,
      durationMs: 1750.5,
      fps: 24,
      loopCount: 7,
    })

    expect(validation.errors).toEqual({})
    expect(validation.staticValues).toEqual({ width: 321, height: 123 })
    expect(validation.animatedValues).toEqual({
      width: 321,
      height: 123,
      durationMs: 1750.5,
      fps: 24,
      loopCount: 7,
    })
  })

  it('rejects empty required values without substituting defaults', () => {
    for (const field of Object.keys(validDrafts) as Array<keyof ExportNumericDrafts>) {
      const validation = validateExportNumericDrafts({ ...validDrafts, [field]: '' })
      expect(validation.errors[field]).toBeDefined()

      if (field === 'width' || field === 'height') {
        expect(validation.staticValues).toBeNull()
      }
      expect(validation.animatedValues).toBeNull()
    }
  })

  it('rejects non-finite and out-of-range values', () => {
    expect(validateExportNumericDrafts({ ...validDrafts, width: Number.POSITIVE_INFINITY }).errors.width).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, height: 0 }).errors.height).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, durationMs: 0 }).errors.durationMs).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, fps: 61 }).errors.fps).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, loopCount: 65536 }).errors.loopCount).toBeDefined()
  })

  it('requires integer pixel dimensions, fps, and loop count', () => {
    expect(validateExportNumericDrafts({ ...validDrafts, width: 128.5 }).errors.width).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, height: 63.5 }).errors.height).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, fps: 23.5 }).errors.fps).toBeDefined()
    expect(validateExportNumericDrafts({ ...validDrafts, loopCount: 1.5 }).errors.loopCount).toBeDefined()
  })

  it('accepts documented boundary values', () => {
    const validation = validateExportNumericDrafts({
      width: 1,
      height: 1,
      durationMs: Number.MIN_VALUE,
      fps: 60,
      loopCount: 65535,
    })

    expect(validation.errors).toEqual({})
    expect(validation.staticValues).not.toBeNull()
    expect(validation.animatedValues).not.toBeNull()
  })
})
