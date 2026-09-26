import { describe, expect, it } from 'vitest'
import { encodeAnimatedGif, webpAnimationFrames, type RasterAnimationFrame } from './animatedAssets'

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

describe('animated GIF mask transparency', () => {
  it('enables transparent palette frames for a clipped opaque export', async () => {
    const raster: RasterAnimationFrame = {
      index: 0,
      timeMs: 0,
      durationMs: 100,
      rgba: new Uint8ClampedArray([
        0, 0, 0, 0, 255, 0, 0, 255,
        255, 0, 0, 255, 0, 0, 0, 0,
      ]),
    }
    const blob = await encodeAnimatedGif([raster], {
      dimensions: { width: 2, height: 2 },
      transparentBackground: false,
      clipToDisplayMask: 'circle',
      durationMs: 100,
      fps: 10,
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const extension = bytes.findIndex((byte, index) =>
      byte === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04)
    expect(extension).toBeGreaterThan(0)
    expect(bytes[extension + 3] & 1).toBe(1)
  })
})
