import { useRef, useState, type ChangeEvent } from 'react'
import type { ExpressionPreset, UserExpressionPreset } from '../../core/presets'

type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

type Props = {
  presets: SelectableExpressionPreset[]
  activePresetId: string
  status: string
  onApply: (preset: SelectableExpressionPreset) => void
  onSaveCurrent: (name: string) => void
  onImport: (json: string) => void
  onExport: (preset: UserExpressionPreset) => void
  onDelete: (preset: UserExpressionPreset) => void
}

export function ExpressionPresetPanel({ presets, activePresetId, status, onApply, onSaveCurrent, onImport, onExport, onDelete }: Props) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const activePreset = presets.find((preset) => preset.id === activePresetId)
  const customPreset = activePreset?.id.startsWith('expression-custom:')
    ? activePreset as UserExpressionPreset
    : undefined

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    onImport(await file.text())
    event.target.value = ''
  }

  return (
    <aside className="panel preset-panel" aria-label="Expression presets">
      <div className="panel-heading">
        <p className="eyebrow">Expression Presets</p>
        <h2>Reusable expressions</h2>
      </div>

      <label className="control-field">
        <span>Expression</span>
        <select value={activePreset?.id ?? 'custom'} onChange={(event) => {
          const preset = presets.find((item) => item.id === event.target.value)
          if (preset) onApply(preset)
        }}>
          <option value="custom" disabled>Custom</option>
          {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
      </label>

      <div className="preset-actions">
        <input className="number-input" type="text" placeholder="Expression preset name" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="button" onClick={() => { onSaveCurrent(name); setName('') }}>Save expression</button>
      </div>

      {status && <p className="preset-status" role="status" aria-live="polite">{status}</p>}

      <div className="preset-file-actions">
        <button type="button" onClick={() => inputRef.current?.click()}>Import JSON</button>
        <button type="button" disabled={!customPreset} onClick={() => customPreset && onExport(customPreset)}>Export JSON</button>
        <button type="button" disabled={!customPreset} onClick={() => customPreset && onDelete(customPreset)}>Delete</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importFile} />
      </div>
    </aside>
  )
}
