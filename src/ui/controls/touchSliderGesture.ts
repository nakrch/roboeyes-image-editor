export const TOUCH_DRAG_THRESHOLD_PX = 8
// Touch fine drag intentionally moves at three quarters of the normal relative rate.
export const TOUCH_FINE_DRAG_SCALE = 0.75

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
  sensitivity = 1,
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0 || max <= min) return startValue
  const safeSensitivity = Number.isFinite(sensitivity) && sensitivity >= 0 ? sensitivity : 1
  const next = startValue + (deltaX / trackWidth) * (max - min) * safeSensitivity
  return Math.min(max, Math.max(min, next))
}
