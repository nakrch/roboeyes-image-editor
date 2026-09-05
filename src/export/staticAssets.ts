import type { FaceModel } from '../core/model'
import { renderFaceToSvg } from '../renderers/svg'

export type ExportDimensions = {
  width: number
  height: number
}

export type StaticExportOptions = {
  dimensions?: ExportDimensions
  transparentBackground?: boolean
}

function sanitizeDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.round(value))
}

export function renderExportSvg(
  model: FaceModel,
  options: StaticExportOptions = {},
): string {
  const source = renderFaceToSvg(model, {
    transparentBackground: options.transparentBackground,
  })
  const width = sanitizeDimension(options.dimensions?.width ?? model.canvas.width, model.canvas.width)
  const height = sanitizeDimension(options.dimensions?.height ?? model.canvas.height, model.canvas.height)

  return source
    .replace(/width="[^"]+"/, `width="${width}"`)
    .replace(/height="[^"]+"/, `height="${height}"`)
}

export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

export async function renderExportPng(
  model: FaceModel,
  options: StaticExportOptions = {},
): Promise<Blob> {
  const width = sanitizeDimension(options.dimensions?.width ?? model.canvas.width, model.canvas.width)
  const height = sanitizeDimension(options.dimensions?.height ?? model.canvas.height, model.canvas.height)
  const svg = renderExportSvg(model, { ...options, dimensions: { width, height } })
  const svgBlob = svgToBlob(svg)
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = new Image()
    image.decoding = 'sync'

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to rasterize SVG'))
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

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to encode PNG'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
