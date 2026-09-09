import { describe, expect, it } from 'vitest'
import {
  formatNumericControlValue,
  normalizeNumericControlValue,
  numericControlBounds,
  resolveNumericDraft,
} from './numericInputDraft'

describe('resolveNumericDraft', () => {
  it('keeps temporary empty input uncommitted', () => {
    expect(resolveNumericDraft('', -100, 100)).toBeNull()
    expect(resolveNumericDraft('   ', -100, 100)).toBeNull()
  })

  it('accepts valid integer, negative, and decimal drafts', () => {
    expect(resolveNumericDraft('42', -100, 100)).toBe(42)
    expect(resolveNumericDraft('-12', -100, 100)).toBe(-12)
    expect(resolveNumericDraft('3.5', -100, 100)).toBe(3.5)
  })

  it('rejects non-finite drafts', () => {
    expect(resolveNumericDraft('not-a-number', -100, 100)).toBeNull()
    expect(resolveNumericDraft('Infinity', -100, 100)).toBeNull()
  })

  it('clamps committed values to the configured range', () => {
    expect(resolveNumericDraft('150', -100, 100)).toBe(100)
    expect(resolveNumericDraft('-150', -100, 100)).toBe(-100)
  })

  it('rounds decimal-capable drafts to at most two fractional digits', () => {
    expect(resolveNumericDraft('12.3456', -100, 100, 'any')).toBe(12.35)
    expect(resolveNumericDraft('-12.3456', -100, 100, 'any')).toBe(-12.35)
    expect(resolveNumericDraft('4.5', -100, 100, 0.05)).toBe(4.5)
    expect(resolveNumericDraft('-0.004', -100, 100, 'any')).toBe(0)
  })

  it('keeps integer-step controls integer-only', () => {
    expect(resolveNumericDraft('12.6', 0, 100, 1)).toBe(13)
    expect(resolveNumericDraft('12.4', 0, 100, 100)).toBe(12)
  })
})

describe('numeric control precision', () => {
  it('normalizes slider and touch-derived fractions to two digits', () => {
    expect(normalizeNumericControlValue(12.345678, -100, 100, 'any')).toBe(12.35)
    expect(normalizeNumericControlValue(-9.876543, -100, 100, 0.5)).toBe(-9.88)
  })

  it('uses conservative two-decimal bounds for dynamic safe ranges', () => {
    expect(numericControlBounds(-63.934, 64.047, 'any')).toEqual({ min: -63.93, max: 64.04 })
    expect(normalizeNumericControlValue(-100, -63.934, 64.047, 'any')).toBe(-63.93)
    expect(normalizeNumericControlValue(100, -63.934, 64.047, 'any')).toBe(64.04)
  })

  it('formats floating-point tails without trailing artifacts', () => {
    expect(formatNumericControlValue(1.2300000004, -10, 10, 'any')).toBe('1.23')
    expect(formatNumericControlValue(4.5, -10, 10, 'any')).toBe('4.5')
  })
})
