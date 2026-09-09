import { describe, expect, it } from 'vitest'
import { webpAnimationFrames, type RasterAnimationFrame } from './animatedAssets'

function frame(index: number, timeMs: number, durationMs: number): RasterAnimationFrame {
  return {
    index,
    timeMs,
    durationMs,
    rgba: new Uint8ClampedArray([index, index, index, 255]),
  }
}

describe('animated WebP frame adaptation', () => {
  it('converts sampled frame durations to cumulative libwebp timestamps', () => {
    const encoded = webpAnimationFrames([
      frame(0, 0, 50),
      frame(1, 50, 50),
      frame(2, 100, 50),
    ])

    expect(encoded.map((item) => item.duration)).toEqual([0, 50, 100, 150])
  })

  it('uses the requested clipped final duration as the terminal timestamp', () => {
    const encoded = webpAnimationFrames([
      frame(0, 0, 250),
      frame(1, 250, 250),
      frame(2, 500, 50),
    ])

    expect(encoded.map((item) => item.duration)).toEqual([0, 250, 500, 550])
    expect(encoded.at(-1)?.data).toEqual(encoded.at(-2)?.data)
    expect(encoded.at(-1)?.data).not.toBe(encoded.at(-2)?.data)
  })
})
