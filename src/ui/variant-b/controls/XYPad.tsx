import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useContinuousEdit } from '../../editor/continuousEdit'

type XYPadProps = {
  label: string
  valueX: number
  valueY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  step?: number
  unit?: string
  onChange: (x: number, y: number) => void
  disabled?: boolean
  showCenterButton?: boolean
}

export function XYPad({
  label,
  valueX,
  valueY,
  minX,
  maxX,
  minY,
  maxY,
  step = 1,
  unit = 'px',
  onChange,
  disabled = false,
  showCenterButton = true,
}: XYPadProps) {
  const padRef = useRef<HTMLDivElement>(null)
  const continuousEdit = useContinuousEdit()
  const isDragging = useRef(false)

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

  const roundToStep = (val: number, s: number) => {
    if (s <= 0 || s === 1) return Math.round(val)
    const inv = 1 / s
    return Math.round(val * inv) / inv
  }

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!padRef.current) return
    const rect = padRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const normalizedX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const normalizedY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))

    const rawX = minX + normalizedX * (maxX - minX)
    const rawY = minY + normalizedY * (maxY - minY)

    const nextX = clamp(roundToStep(rawX, step), minX, maxX)
    const nextY = clamp(roundToStep(rawY, step), minY, maxY)

    if (nextX !== valueX || nextY !== valueY) {
      onChange(nextX, nextY)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDragging.current = true
    continuousEdit.begin()
    updateFromPointer(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || disabled) return
    updateFromPointer(event.clientX, event.clientY)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    continuousEdit.end()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }

  // Calculate dot position in percent
  const percentX = maxX > minX ? clamp(((valueX - minX) / (maxX - minX)) * 100, 0, 100) : 50
  const percentY = maxY > minY ? clamp(((valueY - minY) / (maxY - minY)) * 100, 0, 100) : 50

  const handleCenter = () => {
    if (disabled) return
    const centerX = minX <= 0 && maxX >= 0 ? 0 : roundToStep((minX + maxX) / 2, step)
    const centerY = minY <= 0 && maxY >= 0 ? 0 : roundToStep((minY + maxY) / 2, step)
    continuousEdit.begin()
    onChange(centerX, centerY)
    continuousEdit.end()
  }

  return (
    <div className={`vb-xy-pad-wrap ${disabled ? 'disabled' : ''}`}>
      <div className="vb-xy-header">
        <span className="vb-xy-label">{label}</span>
        <div className="vb-xy-readout">
          <span className="vb-xy-coord">
            X: <strong>{roundToStep(valueX, step)}</strong>
            {unit}
          </span>
          <span className="vb-xy-coord">
            Y: <strong>{roundToStep(valueY, step)}</strong>
            {unit}
          </span>
          {showCenterButton && (
            <button
              type="button"
              className="vb-xy-center-btn"
              onClick={handleCenter}
              disabled={disabled}
              title="Reset to center (0, 0)"
            >
              ⌖ Center
            </button>
          )}
        </div>
      </div>

      <div
        ref={padRef}
        className="vb-xy-pad"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label={`${label} 2D control`}
        aria-valuetext={`X: ${valueX}${unit}, Y: ${valueY}${unit}`}
        style={{ touchAction: 'none' }}
      >
        {/* Crosshair guidelines */}
        <div className="vb-xy-grid-cross-x" />
        <div className="vb-xy-grid-cross-y" />

        {/* Current position indicator */}
        <div
          className="vb-xy-pointer"
          style={{
            left: `${percentX}%`,
            top: `${percentY}%`,
          }}
        >
          <div className="vb-xy-pointer-ring" />
          <div className="vb-xy-pointer-dot" />
        </div>
      </div>
    </div>
  )
}
