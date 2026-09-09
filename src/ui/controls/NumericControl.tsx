import { useEffect, useRef, useState } from 'react'
import { useContinuousEdit } from '../editor/continuousEdit'
import { resolveNumericDraft } from './numericInputDraft'
import {
  classifyTouchSliderIntent,
  TOUCH_FINE_DRAG_SCALE,
  valueFromTouchSliderDrag,
  type TouchSliderIntent,
} from './touchSliderGesture'

type NumericControlProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number | 'any'
  onChange: (value: number) => void
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

export function NumericControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumericControlProps) {
  const continuousEdit = useContinuousEdit()
  const touchDrag = useRef<TouchDragState | null>(null)
  const suppressTouchClick = useRef(false)
  const numberInputEditing = useRef(false)
  const [numberDraft, setNumberDraft] = useState(() => String(value))

  useEffect(() => {
    if (!numberInputEditing.current) setNumberDraft(String(value))
  }, [value])

  const endTouchDrag = () => {
    if (touchDrag.current?.intent === 'horizontal') continuousEdit.end()
    touchDrag.current = null
  }

  const commitNumberDraft = () => {
    const committed = resolveNumericDraft(numberDraft, min, max)
    if (committed === null) {
      setNumberDraft(String(value))
      return
    }

    setNumberDraft(String(committed))
    if (committed !== value) onChange(committed)
  }

  return (
    <label className="control-field">
      <span>{label}</span>
      <div className="control-inputs">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(event) => {
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
              startValue: value,
              trackWidth: event.currentTarget.getBoundingClientRect().width,
              intent: 'pending',
            }
          }}
          onPointerMove={(event) => {
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
            onChange(valueFromTouchSliderDrag(
              drag.startValue,
              deltaX,
              drag.trackWidth,
              min,
              max,
              TOUCH_FINE_DRAG_SCALE,
            ))
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
            onChange(Number(event.target.value))
          }}
        />
        <input
          className="number-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={numberDraft}
          onFocus={() => {
            numberInputEditing.current = true
            setNumberDraft(String(value))
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
      </div>
    </label>
  )
}
