import type { ReactNode } from 'react'

type Option<T extends string> = {
  value: T
  label: ReactNode
  badge?: string | number
}

type ModeSwitchProps<T extends string> = {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export function ModeSwitch<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: ModeSwitchProps<T>) {
  return (
    <div className={`vb-mode-switch vb-mode-switch-${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`vb-mode-switch-item ${active ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className="vb-mode-switch-label">{option.label}</span>
            {option.badge !== undefined && (
              <span className="vb-mode-switch-badge">{option.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
