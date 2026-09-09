import { describe, expect, it } from 'vitest'
import { webpAnimationFrames, type RasterAnimationFrame } from './animatedAssets'

function frame(index: number, timeMs: number, durationMs: number): RasterAnimationFrame {
  return {
    index,
    timeMs,
    durationMs,
    rgba: new Uint8ClampedArray([index, index + 1, index + 2, 255]),
  }
}

describe('animated WebP frame adaptation', () => {
  it('passes deterministic sampled durations through to wasm-webp', () => {
    const encoded = webpAnimationFrames([
      frame(0, 0, 50),
      frame(1, 50, 50),
      frame(2, 100, 50),
    ])

    expect(encoded.map((item) => item.duration)).toEqual([50, 50, 50])
    expect(encoded).toHaveLength(3)
  })

  it('preserves the clipped final duration and RGBA byte layout', () => {
    const encoded = webpAnimationFrames([
      frame(0, 0, 250),
      frame(1, 250, 250),
      frame(2, 500, 50),
    ])

    expect(encoded.map((item) => item.duration)).toEqual([250, 250, 50])
    expect(Array.from(encoded[0].data)).toEqual([0, 1, 2, 255])
    expect(encoded[0].data).not.toBe(encoded[1].data)
  })
})
