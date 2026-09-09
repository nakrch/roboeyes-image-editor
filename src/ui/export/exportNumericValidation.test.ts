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
    expect(validation.webpValues).toEqual({
      width: 321,
      height: 123,
      durationMs: 1750.5,
      fps: 24,
    })
    expect(validation.gifValues).toEqual({
      width: 321,
      height: 123,
      durationMs: 1750.5,
      fps: 24,
      loopCount: 7,
    })
  })

  it('rejects empty dimensions for every export format', () => {
    for (const field of ['width', 'height'] as const) {
      const validation = validateExportNumericDrafts({ ...validDrafts, [field]: '' })
      expect(validation.errors[field]).toBeDefined()
      expect(validation.staticValues).toBeNull()
      expect(validation.webpValues).toBeNull()
      expect(validation.gifValues).toBeNull()
    }
  })

  it('rejects empty duration or fps for animated formats without affecting static export', () => {
    for (const field of ['durationMs', 'fps'] as const) {
      const validation = validateExportNumericDrafts({ ...validDrafts, [field]: '' })
      expect(validation.errors[field]).toBeDefined()
      expect(validation.staticValues).toEqual({ width: 128, height: 64 })
      expect(validation.webpValues).toBeNull()
      expect(validation.gifValues).toBeNull()
    }
  })

  it('requires an explicit GIF loop count without unnecessarily blocking WebP', () => {
    const validation = validateExportNumericDrafts({ ...validDrafts, loopCount: '' })

    expect(validation.errors.loopCount).toBe('GIF loop count is required.')
    expect(validation.staticValues).toEqual({ width: 128, height: 64 })
    expect(validation.webpValues).toEqual({ width: 128, height: 64, durationMs: 2000, fps: 20 })
    expect(validation.gifValues).toBeNull()
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
    expect(validation.webpValues).not.toBeNull()
    expect(validation.gifValues).not.toBeNull()
  })
})
