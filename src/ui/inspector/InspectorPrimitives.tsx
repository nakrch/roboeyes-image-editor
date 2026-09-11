import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'

type InspectorSectionProps = {
  title: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
}

type InspectorRowProps = {
  label: string
  children: ReactNode
  hint?: string
}

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  unit?: string
}

type SliderFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

type PointFieldProps = {
  x: number
  y: number
  onXChange: (value: number) => void
  onYChange: (value: number) => void
  step?: number | 'any'
}

type ColorFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

type ToggleFieldProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

type SegmentedControlProps = {
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger'
}

export function InspectorSection({
  title,
  children,
  actions,
  defaultOpen = true,
}: InspectorSectionProps) {
  return (
    <details className="inspector-section" open={defaultOpen}>
      <summary className="inspector-section-heading">
        <span>{title}</span>
        {actions && (
          <span className="inspector-section-actions" onClick={(event) => event.stopPropagation()}>
            {actions}
          </span>
        )}
      </summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  )
}

export function InspectorRow({ label, children, hint }: InspectorRowProps) {
  return (
    <div className="inspector-row">
      <span className="inspector-row-label" title={hint}>{label}</span>
      <div className="inspector-row-value">{children}</div>
    </div>
  )
}

export function NumberField({ unit, className = '', ...props }: NumberFieldProps) {
  return (
    <span className="inspector-number-field">
      <input className={`inspector-number-input ${className}`.trim()} type="number" {...props} />
      {unit && <span className="inspector-unit" aria-hidden="true">{unit}</span>}
    </span>
  )
}

export function SliderField({ className = '', ...props }: SliderFieldProps) {
  return <input className={`inspector-slider ${className}`.trim()} type="range" {...props} />
}

export function PointField({ x, y, onXChange, onYChange, step = 'any' }: PointFieldProps) {
  return (
    <span className="inspector-point-field">
      <label><span>X</span><NumberField value={x} step={step} onChange={(event) => onXChange(Number(event.currentTarget.value))} /></label>
      <label><span>Y</span><NumberField value={y} step={step} onChange={(event) => onYChange(Number(event.currentTarget.value))} /></label>
    </span>
  )
}

export function ColorField({ className = '', ...props }: ColorFieldProps) {
  return <input className={`inspector-color-input ${className}`.trim()} type="color" {...props} />
}

export function ToggleField({ checked, onChange, label, disabled = false }: ToggleFieldProps) {
  return (
    <label className="inspector-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps) {
  return (
    <span className="inspector-segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={option.value === value ? 'active' : ''}
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  )
}

export function ActionButton({ variant = 'default', className = '', ...props }: ActionButtonProps) {
  return (
    <button
      className={`inspector-action-button inspector-action-${variant} ${className}`.trim()}
      type={props.type ?? 'button'}
      {...props}
    />
  )
}
