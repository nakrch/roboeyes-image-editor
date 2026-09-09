import type { TransientOverlay } from '../animation'
import type { FaceModel } from '../core/model'
import { renderFaceToSvg } from '../renderers/svg'
import { animationExportSchedule, type AnimationExportSamplingOptions } from './animationFrames'
import type { ExportDimensions } from './staticAssets'

export type AnimatedExportVisualFrame = {
  model: FaceModel
  overlays?: readonly TransientOverlay[]
}

export type AnimatedExportFrameResolver = (timeMs: number) => AnimatedExportVisualFrame

export type AnimatedImageExportOptions = AnimationExportSamplingOptions & {
  dimensions: ExportDimensions
  transparentBackground: boolean
  loopCount?: number
}

export type RasterAnimationFrame = {
  index: number
  timeMs: number
  durationMs: number
  rgba: Uint8ClampedArray
}

function positiveDimension(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be greater than zero`)
  return Math.max(1, Math.round(value))
}

function gifDelay(durationMs: number): number {
  // GIF stores delays in 10 ms units. Quantize explicitly instead of relying on
  // encoder-specific rounding; never emit a zero-delay frame.
  return Math.max(10, Math.round(durationMs / 10) * 10)
}

function ownedBytes(source: ArrayBuffer | Uint8Array | Uint8ClampedArray): Uint8Array<ArrayBuffer> {
  const view = source instanceof ArrayBuffer ? new Uint8Array(source) : source
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  return copy
}

async function rasterizeSvg(svg: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to rasterize animation frame'))
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas is not available')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function rasterizeAnimationExportFrames(
  options: AnimatedImageExportOptions,
  resolveFrame: AnimatedExportFrameResolver,
): Promise<readonly RasterAnimationFrame[]> {
  const width = positiveDimension(options.dimensions.width, 'width')
  const height = positiveDimension(options.dimensions.height, 'height')
  const result: RasterAnimationFrame[] = []

  for (const sample of animationExportSchedule(options)) {
    const visual = resolveFrame(sample.timeMs)
    const svg = renderFaceToSvg(visual.model, {
      transparentBackground: options.transparentBackground,
      overlays: visual.overlays,
    })
      .replace(/width="[^"]+"/, `width="${width}"`)
      .replace(/height="[^"]+"/, `height="${height}"`)
    result.push({ ...sample, rgba: await rasterizeSvg(svg, width, height) })
  }
  return result
}

export async function encodeAnimatedGif(
  frames: readonly RasterAnimationFrame[],
  options: AnimatedImageExportOptions,
): Promise<Blob> {
  if (frames.length === 0) throw new RangeError('frames must not be empty')
  const { encode } = await import('modern-gif')
  const width = positiveDimension(options.dimensions.width, 'width')
  const height = positiveDimension(options.dimensions.height, 'height')
  const loopCount = Math.max(0, Math.min(65535, Math.round(options.loopCount ?? 0)))
  const bytes = await encode({
    width,
    height,
    looped: true,
    loopCount,
    maxColors: 255,
    premultipliedAlpha: false,
    frames: frames.map((frame) => ({
      data: ownedBytes(frame.rgba),
      delay: gifDelay(frame.durationMs),
      transparent: options.transparentBackground,
      disposal: 2,
    })),
  })
  return new Blob([ownedBytes(bytes)], { type: 'image/gif' })
}

type WebpAnimationFrame = {
  data: Uint8Array<ArrayBuffer>
  duration: number
  config: { lossless: number; quality: number }
}

export function webpAnimationFrames(frames: readonly RasterAnimationFrame[]): WebpAnimationFrame[] {
  // wasm-webp expects each frame's display duration and accumulates timestamps
  // internally before calling WebPAnimEncoderAdd.
  return frames.map((frame) => ({
    data: ownedBytes(frame.rgba),
    duration: Math.max(1, Math.round(frame.durationMs)),
    config: { lossless: 1, quality: 100 },
  }))
}

export async function encodeAnimatedWebp(
  frames: readonly RasterAnimationFrame[],
  options: AnimatedImageExportOptions,
): Promise<Blob> {
  if (frames.length === 0) throw new RangeError('frames must not be empty')
  const { encodeAnimation } = await import('wasm-webp')
  const width = positiveDimension(options.dimensions.width, 'width')
  const height = positiveDimension(options.dimensions.height, 'height')

  // Rasterization always produces four-byte RGBA pixels. wasm-webp switches
  // between RGB and RGBA import solely from this flag, so passing false for an
  // opaque export would make it read the RGBA buffer with a three-byte stride.
  // Keep RGBA import enabled; opaque frames already carry alpha=255.
  const bytes = await encodeAnimation(
    width,
    height,
    true,
    webpAnimationFrames(frames),
  )
  if (bytes == null) throw new Error('Animated WebP encoder returned no data')
  return new Blob([ownedBytes(bytes)], { type: 'image/webp' })
}

export const animatedExportLimitations = {
  gif: 'GIF timing is quantized to 10 ms and color is palette-limited to 255 colors. Transparency is binary/palette based.',
  webp: 'Animated WebP uses lossless RGBA frames. The current browser WASM adapter does not expose loop-count metadata, so playback uses the encoder default.',
} as const
