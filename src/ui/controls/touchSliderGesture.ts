export const TOUCH_DRAG_THRESHOLD_PX = 8

export type TouchSliderIntent = 'pending' | 'horizontal' | 'vertical'

export function classifyTouchSliderIntent(
  deltaX: number,
  deltaY: number,
  threshold = TOUCH_DRAG_THRESHOLD_PX,
): TouchSliderIntent {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (Math.max(absX, absY) < threshold) return 'pending'
  return absX > absY ? 'horizontal' : 'vertical'
}

export function valueFromTouchSliderDrag(
  startValue: number,
  deltaX: number,
  trackWidth: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0 || max <= min) return startValue
  const next = startValue + (deltaX / trackWidth) * (max - min)
  return Math.min(max, Math.max(min, next))
}
