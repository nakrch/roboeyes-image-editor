import { useState } from 'react'
import type { ExpressionPreset, UserExpressionPreset } from '../../../core/presets'

type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

type ExpressionCarouselProps = {
  presets: readonly SelectableExpressionPreset[]
  activePresetId: string
  disabled?: boolean
  onApply: (preset: SelectableExpressionPreset) => void
  onSaveCurrent: (name: string) => void
  onDelete?: (preset: UserExpressionPreset) => void
}

const EXPRESSION_ICONS: Record<string, string> = {
  'expression:neutral': '😐',
  'expression:happy': '😊',
  'expression:sad': '😢',
  'expression:angry': '😠',
  'expression:curious': '🤨',
  'expression:surprised': '😲',
  'expression:skeptical': '😒',
  'expression:sleeping': '😴',
  'expression:tired': '🥱',
  'expression:furious': '😡',
  'expression:gleeful': '😆',
  'expression:worried': '😟',
  'expression:smug': '😏',
  'expression:proud': '😌',
  'expression:cheeky': '😜',
  'expression:focused': '🧐',
}

export function ExpressionCarousel({
  presets,
  activePresetId,
  disabled = false,
  onApply,
  onSaveCurrent,
  onDelete,
}: ExpressionCarouselProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPresetName.trim() || disabled) return
    onSaveCurrent(newPresetName.trim())
    setNewPresetName('')
    setIsAdding(false)
  }

  return (
    <div className={`vb-expression-carousel-strip ${disabled ? 'disabled' : ''}`}>
      <div className="vb-carousel-header">
        <span className="vb-carousel-title">EXPRESSION PRESETS</span>
        {!disabled && (
          <button
            type="button"
            className="vb-carousel-add-btn"
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? '✕ Cancel' : '＋ Save Current'}
          </button>
        )}
      </div>

      {isAdding && !disabled && (
        <form className="vb-carousel-save-form" onSubmit={handleSave}>
          <input
            type="text"
            className="vb-carousel-save-input"
            placeholder="Expression name..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="vb-carousel-save-submit" disabled={!newPresetName.trim()}>
            Save
          </button>
        </form>
      )}

      <div className="vb-carousel-items-scroll">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId
          const icon = EXPRESSION_ICONS[preset.id] ?? '✨'
          const isCustom = preset.id.startsWith('custom:')

          return (
            <div key={preset.id} className="vb-carousel-card-wrap">
              <button
                type="button"
                className={`vb-carousel-card ${isActive ? 'active' : ''}`}
                onClick={() => onApply(preset)}
                disabled={disabled}
                title={preset.name}
              >
                <span className="vb-carousel-icon">{icon}</span>
                <span className="vb-carousel-label">{preset.name}</span>
              </button>

              {isCustom && onDelete && !disabled && (
                <button
                  type="button"
                  className="vb-carousel-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(preset as UserExpressionPreset)
                  }}
                  title={`Delete ${preset.name}`}
                  aria-label={`Delete ${preset.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
