import { describe, expect, it } from 'vitest'
import { resolveNumericDraft } from './numericInputDraft'

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
})
