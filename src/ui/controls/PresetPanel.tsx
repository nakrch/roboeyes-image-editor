import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { FacePreset } from '../../core/presets'

type PresetPanelProps = {
  presets: FacePreset[]
  activePresetId: string
  status: string
  onApply: (preset: FacePreset) => void
  onSaveCurrent: (name: string) => void
  onImport: (json: string) => void
  onExport: (preset: FacePreset) => void
  onDelete: (preset: FacePreset) => void
}

export function PresetPanel({
  presets,
  activePresetId,
  status,
  onApply,
  onSaveCurrent,
  onImport,
  onExport,
  onDelete,
}: PresetPanelProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const activePreset = presets.find((preset) => preset.id === activePresetId)
  const customPreset = activePreset?.id.startsWith('custom:') ? activePreset : undefined

  useEffect(() => {
    if (activePreset) setName(activePreset.name)
  }, [activePreset?.id, activePreset?.name])

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    onImport(await file.text())
    event.target.value = ''
  }

  return (
    <aside className="panel preset-panel" aria-label="Presets">
      <div className="panel-heading">
        <p className="eyebrow">Presets</p>
        <h2>Style defaults</h2>
      </div>

      <label className="control-field">
        <span>Preset</span>
        <select
          value={activePreset?.id ?? 'custom'}
          onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value)
            if (preset) onApply(preset)
          }}
        >
          <option value="custom" disabled>Custom</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>

      <div className="preset-actions">
        <input
          className="number-input"
          type="text"
          placeholder="Custom preset name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="button" onClick={() => onSaveCurrent(name)}>
          Save current
        </button>
      </div>

      {status && <p className="preset-status" role="status" aria-live="polite">{status}</p>}

      <div className="preset-file-actions">
        <button type="button" onClick={() => inputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" disabled={!customPreset} onClick={() => customPreset && onExport(customPreset)}>
          Export JSON
        </button>
        <button type="button" disabled={!customPreset} onClick={() => customPreset && onDelete(customPreset)}>
          Delete
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={importFile}
        />
      </div>
    </aside>
  )
}
