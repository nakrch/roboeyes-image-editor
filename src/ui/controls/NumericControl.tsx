import { useContinuousEdit } from '../editor/continuousEdit'

type NumericControlProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number | 'any'
  onChange: (value: number) => void
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
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            continuousEdit.begin()
          }}
          onPointerUp={continuousEdit.end}
          onPointerCancel={continuousEdit.end}
          onKeyDown={(event) => {
            if (RANGE_KEYS.has(event.key) && !event.repeat) continuousEdit.begin()
          }}
          onKeyUp={(event) => {
            if (RANGE_KEYS.has(event.key)) continuousEdit.end()
          }}
          onBlur={continuousEdit.end}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="number-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onFocus={continuousEdit.begin}
          onBlur={continuousEdit.end}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  )
}
