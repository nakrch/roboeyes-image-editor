export const CANVAS_MIN = 16
export const CANVAS_MAX = 640

export const resolutionPresets = [
  { key: '128x64', width: 128, height: 64 },
  { key: '128x128', width: 128, height: 128 },
  { key: '240x240', width: 240, height: 240 },
  { key: '320x240', width: 320, height: 240 },
  { key: '320x320', width: 320, height: 320 },
] as const

export function normalizeCanvasDimension(value: number, minimum: number): number {
  return Math.min(CANVAS_MAX, Math.max(minimum, Math.round(value)))
}
