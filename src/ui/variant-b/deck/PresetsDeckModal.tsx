import { useState } from 'react'
import type { FacePreset } from '../../../core/presets'

type PresetsDeckModalProps = {
  isOpen: boolean
  presets: readonly FacePreset[]
  activePresetId: string
  statusMessage?: string
  errorMessage?: string
  onClose: () => void
  onApply: (preset: FacePreset) => void
  onSaveCurrent: (name: string) => void
  onImport: (json: string) => void
  onExport: (preset: FacePreset) => void
  onDelete: (preset: FacePreset) => void
}

export function PresetsDeckModal({
  isOpen,
  presets,
  activePresetId,
  statusMessage,
  errorMessage,
  onClose,
  onApply,
  onSaveCurrent,
  onImport,
  onExport,
  onDelete,
}: PresetsDeckModalProps) {
  const [saveName, setSaveName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!saveName.trim()) return
    onSaveCurrent(saveName.trim())
    setSaveName('')
    setIsSaving(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        onImport(content)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="vb-modal-overlay" role="dialog" aria-modal="true" aria-label="Face Presets Manager">
      <div className="vb-modal-panel">
        <header className="vb-modal-header">
          <div className="vb-modal-title">
            <span className="vb-modal-tag">LIBRARY</span>
            <h3>Face Presets & Storage</h3>
          </div>
          <button type="button" className="vb-modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </header>

        {statusMessage && <div className="vb-status-banner">{statusMessage}</div>}
        {errorMessage && <div className="vb-error-banner" role="alert">{errorMessage}</div>}

        <div className="vb-modal-body">
          {/* Quick Actions Bar */}
          <div className="vb-modal-toolbar">
            <button
              type="button"
              className="vb-modal-btn vb-modal-btn-primary"
              onClick={() => setIsSaving(!isSaving)}
            >
              {isSaving ? '✕ Cancel' : '＋ Save Current As Preset'}
            </button>

            <label className="vb-modal-btn vb-modal-file-btn">
              <span>📥 Import JSON</span>
              <input type="file" accept=".json,application/json" onChange={handleFileInput} />
            </label>
          </div>

          {isSaving && (
            <form className="vb-modal-save-form" onSubmit={handleSaveSubmit}>
              <input
                type="text"
                className="vb-modal-save-input"
                placeholder="Enter preset name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="vb-modal-btn vb-modal-btn-primary" disabled={!saveName.trim()}>
                Save Preset
              </button>
            </form>
          )}

          {/* Presets List */}
          <div className="vb-presets-list">
            {presets.map((preset) => {
              const isSelected = preset.id === activePresetId
              const isCustom = preset.id.startsWith('custom:')

              return (
                <div
                  key={preset.id}
                  className={`vb-preset-row ${isSelected ? 'active' : ''}`}
                  onClick={() => onApply(preset)}
                >
                  <div className="vb-preset-info">
                    <span className="vb-preset-name">{preset.name}</span>
                    <span className="vb-preset-type-badge">
                      {isCustom ? 'CUSTOM' : 'BUILT-IN'}
                    </span>
                  </div>

                  <div className="vb-preset-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="vb-row-action-btn"
                      onClick={() => onExport(preset)}
                      title="Export preset JSON"
                    >
                      Export
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        className="vb-row-action-btn vb-row-delete-btn"
                        onClick={() => onDelete(preset)}
                        title="Delete custom preset"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
