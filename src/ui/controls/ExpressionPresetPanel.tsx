import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { ExpressionPreset, UserExpressionPreset } from '../../core/presets'
import { useToast } from '../feedback/ToastProvider'

type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

type Props = {
  presets: SelectableExpressionPreset[]
  activePresetId: string
  status: string
  disabled?: boolean
  onApply: (preset: SelectableExpressionPreset) => void
  onSaveCurrent: (name: string) => void
  onImport: (json: string) => void
  onExport: (preset: UserExpressionPreset) => void
  onDelete: (preset: UserExpressionPreset) => void
}

export function ExpressionPresetPanel({
  presets,
  activePresetId,
  status,
  disabled = false,
  onApply,
  onSaveCurrent,
  onImport,
  onExport,
  onDelete,
}: Props) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { notify } = useToast()
  const activePreset = presets.find((preset) => preset.id === activePresetId)
  const customPreset = activePreset?.id.startsWith('expression-custom:')
    ? activePreset as UserExpressionPreset
    : undefined

  useEffect(() => {
    if (activePreset) setName(activePreset.name)
  }, [activePreset?.id, activePreset?.name])

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || disabled) return
    onImport(await file.text())
    event.target.value = ''
  }

  const applyPreset = (preset: SelectableExpressionPreset) => {
    try {
      onApply(preset)
      notify('success', `Applied “${preset.name}”.`)
    } catch {
      notify('error', `Could not apply “${preset.name}”.`)
    }
  }

  const exportPreset = (preset: UserExpressionPreset) => {
    try {
      onExport(preset)
      notify('success', `Exported “${preset.name}”.`)
    } catch {
      notify('error', `Could not export “${preset.name}”.`)
    }
  }

  const deletePreset = (preset: UserExpressionPreset) => {
    try {
      onDelete(preset)
      notify('success', `Deleted “${preset.name}”.`)
    } catch {
      notify('error', `Could not delete “${preset.name}”.`)
    }
  }

  return (
    <aside className="panel preset-panel" aria-label="Expression presets" aria-disabled={disabled}>
      <div className="panel-heading">
        <p className="eyebrow">Expression Presets</p>
        <h2>Reusable expressions</h2>
      </div>

      {disabled && (
        <p className="animation-note">
          Single-eye mode is fixed to Neutral. Switch to Two eyes to select, save, import, or edit expressions.
        </p>
      )}

      <label className="control-field">
        <span>Expression</span>
        <select disabled={disabled} value={activePreset?.id ?? 'custom'} onChange={(event) => {
          const preset = presets.find((item) => item.id === event.target.value)
          if (preset) applyPreset(preset)
        }}>
          <option value="custom" disabled>Custom</option>
          {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
      </label>

      <div className="preset-actions">
        <input disabled={disabled} className="number-input" type="text" placeholder="Expression preset name" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="button" disabled={disabled} onClick={() => onSaveCurrent(name)}>Save expression</button>
      </div>

      {status && <p className="preset-status" role="status" aria-live="polite">{status}</p>}

      <div className="preset-file-actions">
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>Import JSON</button>
        <button type="button" disabled={disabled || !customPreset} onClick={() => customPreset && exportPreset(customPreset)}>Export JSON</button>
        <button type="button" disabled={disabled || !customPreset} onClick={() => customPreset && deletePreset(customPreset)}>Delete</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" disabled={disabled} onChange={importFile} />
      </div>
    </aside>
  )
}
