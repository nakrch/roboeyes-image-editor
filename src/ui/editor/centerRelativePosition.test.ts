import { describe, expect, it } from 'vitest'
import {
  centerRelativePositionRange,
  fromCenterRelativePosition,
  toCenterRelativePosition,
} from './centerRelativePosition'

const canvas128x64 = { canvas: { width: 128, height: 64 } }

describe('center-relative position controls', () => {
  it('represents the canvas center as zero', () => {
    expect(toCenterRelativePosition(canvas128x64, 'x', 64)).toBe(0)
    expect(toCenterRelativePosition(canvas128x64, 'y', 32)).toBe(0)
  })

  it('converts positive and negative offsets back to absolute coordinates', () => {
    expect(fromCenterRelativePosition(canvas128x64, 'x', 10)).toBe(74)
    expect(fromCenterRelativePosition(canvas128x64, 'x', -10)).toBe(54)
    expect(fromCenterRelativePosition(canvas128x64, 'y', 8)).toBe(40)
    expect(fromCenterRelativePosition(canvas128x64, 'y', -8)).toBe(24)
  })

  it('keeps the same relative value when canvas resizing shifts absolute coordinates with the center', () => {
    const before = { canvas: { width: 128, height: 64 } }
    const after = { canvas: { width: 240, height: 160 } }

    expect(toCenterRelativePosition(before, 'x', 74)).toBe(10)
    expect(toCenterRelativePosition(after, 'x', 130)).toBe(10)
    expect(toCenterRelativePosition(before, 'y', 27)).toBe(-5)
    expect(toCenterRelativePosition(after, 'y', 75)).toBe(-5)
  })

  it('translates existing absolute control ranges without changing reachable absolute values', () => {
    expect(centerRelativePositionRange(canvas128x64, 'x', -320, 640)).toEqual({
      min: -384,
      max: 576,
    })
    expect(centerRelativePositionRange(canvas128x64, 'y', -320, 640)).toEqual({
      min: -352,
      max: 608,
    })
  })
})
