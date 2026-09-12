import { useEffect, useRef, useState } from 'react'
import { useContinuousEdit } from '../../editor/continuousEdit'
import {
  formatNumericControlValue,
  normalizeNumericControlValue,
  numericControlBounds,
  resolveNumericDraft,
} from '../../controls/numericInputDraft'
import {
  classifyTouchSliderIntent,
  TOUCH_FINE_DRAG_SCALE,
  valueFromTouchSliderDrag,
  type TouchSliderIntent,
} from '../../controls/touchSliderGesture'

type TactileSliderProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number | 'any'
  unit?: string
  onChange: (value: number) => void
  disabled?: boolean
}

type TouchDragState = {
  pointerId: number
  startX: number
  startY: number
  startValue: number
  trackWidth: number
  intent: TouchSliderIntent
}

const RANGE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

export function TactileSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
}: TactileSliderProps) {
  const continuousEdit = useContinuousEdit()
  const touchDrag = useRef<TouchDragState | null>(null)
  const suppressTouchClick = useRef(false)
  const numberInputEditing = useRef(false)
  const bounds = numericControlBounds(min, max, step)
  const displayedValue = normalizeNumericControlValue(value, min, max, step)
  const [numberDraft, setNumberDraft] = useState(() =>
    formatNumericControlValue(value, min, max, step),
  )

  useEffect(() => {
    if (!numberInputEditing.current) {
      setNumberDraft(formatNumericControlValue(value, min, max, step))
    }
  }, [max, min, step, value])

  const emitNormalizedChange = (next: number) => {
    const normalized = normalizeNumericControlValue(next, min, max, step)
    if (normalized !== value) onChange(normalized)
  }

  const endTouchDrag = () => {
    if (touchDrag.current?.intent === 'horizontal') continuousEdit.end()
    touchDrag.current = null
  }

  const commitNumberDraft = () => {
    const committed = resolveNumericDraft(numberDraft, min, max, step)
    if (committed === null) {
      setNumberDraft(formatNumericControlValue(value, min, max, step))
      return
    }
    setNumberDraft(String(committed))
    if (committed !== value) onChange(committed)
  }

  const percentage = bounds.max > bounds.min
    ? Math.max(0, Math.min(100, ((displayedValue - bounds.min) / (bounds.max - bounds.min)) * 100))
    : 0

  return (
    <div className={`vb-tactile-slider ${disabled ? 'disabled' : ''}`}>
      <div className="vb-slider-header">
        <span className="vb-slider-label">{label}</span>
        <div className="vb-slider-value-wrap">
          <input
            className="vb-number-input"
            type="number"
            min={bounds.min}
            max={bounds.max}
            step={step}
            value={numberDraft}
            disabled={disabled}
            onFocus={() => {
              numberInputEditing.current = true
              setNumberDraft(formatNumericControlValue(value, min, max, step))
              continuousEdit.begin()
            }}
            onBlur={() => {
              commitNumberDraft()
              numberInputEditing.current = false
              continuousEdit.end()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            onChange={(event) => setNumberDraft(event.currentTarget.value)}
          />
          {unit && <span className="vb-slider-unit">{unit}</span>}
        </div>
      </div>

      <div className="vb-slider-track-wrap">
        <input
          type="range"
          className="vb-slider-range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={displayedValue}
          disabled={disabled}
          style={
            {
              '--fill-percent': `${percentage}%`,
              touchAction: 'pan-y',
            } as React.CSSProperties
          }
          onPointerDown={(event) => {
            if (disabled) return
            if (event.pointerType === 'mouse') {
              event.currentTarget.setPointerCapture(event.pointerId)
              continuousEdit.begin()
              return
            }
            suppressTouchClick.current = true
            touchDrag.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              startValue: displayedValue,
              trackWidth: event.currentTarget.getBoundingClientRect().width,
              intent: 'pending',
            }
          }}
          onPointerMove={(event) => {
            if (disabled) return
            const drag = touchDrag.current
            if (!drag || drag.pointerId !== event.pointerId || drag.intent === 'vertical') return

            const deltaX = event.clientX - drag.startX
            const deltaY = event.clientY - drag.startY

            if (drag.intent === 'pending') {
              const intent = classifyTouchSliderIntent(deltaX, deltaY)
              drag.intent = intent
              if (intent === 'pending' || intent === 'vertical') return

              event.currentTarget.setPointerCapture(event.pointerId)
              continuousEdit.begin()
            }

            event.preventDefault()
            emitNormalizedChange(
              valueFromTouchSliderDrag(
                drag.startValue,
                deltaX,
                drag.trackWidth,
                bounds.min,
                bounds.max,
                TOUCH_FINE_DRAG_SCALE,
              ),
            )
          }}
          onPointerUp={(event) => {
            if (event.pointerType === 'mouse') {
              continuousEdit.end()
              return
            }
            endTouchDrag()
          }}
          onPointerCancel={(event) => {
            if (event.pointerType === 'mouse') {
              continuousEdit.end()
              return
            }
            endTouchDrag()
          }}
          onClick={(event) => {
            if (!suppressTouchClick.current) return
            event.preventDefault()
            suppressTouchClick.current = false
          }}
          onKeyDown={(event) => {
            if (RANGE_KEYS.has(event.key) && !event.repeat) continuousEdit.begin()
          }}
          onKeyUp={(event) => {
            if (RANGE_KEYS.has(event.key)) continuousEdit.end()
          }}
          onBlur={() => {
            endTouchDrag()
            continuousEdit.end()
          }}
          onChange={(event) => {
            if (touchDrag.current || suppressTouchClick.current) return
            emitNormalizedChange(Number(event.target.value))
          }}
        />
      </div>
    </div>
  )
}
