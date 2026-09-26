import type { CanvasModel } from './face'

export type DisplayMask = 'none' | 'circle'

export const DISPLAY_MASKS: readonly DisplayMask[] = ['none', 'circle']

export function isDisplayMask(value: unknown): value is DisplayMask {
  return value === 'none' || value === 'circle'
}

export function displayMaskCircle(canvas: CanvasModel): { cx: number; cy: number; r: number } {
  return { cx: canvas.width / 2, cy: canvas.height / 2, r: Math.min(canvas.width, canvas.height) / 2 }
}
