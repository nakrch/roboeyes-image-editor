import { describe, expect, it } from 'vitest'
import { normalizeCanvasDimension } from './canvasDimensions'

describe('normalizeCanvasDimension', () => {
  it('rounds pixel dimensions and clamps to geometric minimum and canvas maximum', () => {
    expect(normalizeCanvasDimension(128.4, 16)).toBe(128)
    expect(normalizeCanvasDimension(128.6, 16)).toBe(129)
    expect(normalizeCanvasDimension(15.2, 32)).toBe(32)
    expect(normalizeCanvasDimension(700.2, 16)).toBe(640)
  })
})
