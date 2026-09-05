import { describe, expect, it } from 'vitest'
import { resolveEyeExpression, type ExpressionModel } from './expression'

describe('expression model', () => {
  const expression: ExpressionModel = {
    upperLid: 0.2,
    lowerLid: 0.1,
    tilt: 5,
    leftEye: { upperLid: 0.6, tilt: -8 },
  }

  it('inherits shared expression values when no eye override is set', () => {
    expect(resolveEyeExpression(expression, 'right')).toEqual({
      upperLid: 0.2,
      lowerLid: 0.1,
      tilt: 5,
      heightScale: 1,
    })
  })

  it('merges per-eye overrides with shared values', () => {
    expect(resolveEyeExpression(expression, 'left')).toEqual({
      upperLid: 0.6,
      lowerLid: 0.1,
      tilt: -8,
      heightScale: 1,
    })
  })

  it('supports per-eye height scale overrides', () => {
    const scaled: ExpressionModel = {
      ...expression,
      heightScale: 1.1,
      leftEye: { ...expression.leftEye, heightScale: 1.3 },
    }

    expect(resolveEyeExpression(scaled, 'right').heightScale).toBe(1.1)
    expect(resolveEyeExpression(scaled, 'left').heightScale).toBe(1.3)
  })
})
