import { useRef, useState, type ChangeEvent } from 'react'
import type { FacePreset } from '../../core/presets'

type PresetPanelProps = {
  presets: FacePreset[]
  activePresetId: string
  onApply: (preset: FacePreset) => void
  onSaveCurrent: (name: string) => void
  onImport: (json: string) => void
  onExport: (preset: FacePreset) => void
}

export function PresetPanel({
  presets,
  activePresetId,
  onApply,
  onSaveCurrent,
  onImport,
  onExport,
}: PresetPanelProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0]

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
          value={activePreset?.id ?? ''}
          onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value)
            if (preset) onApply(preset)
          }}
        >
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
        <button
          type="button"
          onClick={() => {
            onSaveCurrent(name)
            setName('')
          }}
        >
          Save current
        </button>
      </div>

      <div className="preset-file-actions">
        <button type="button" onClick={() => inputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" disabled={!activePreset} onClick={() => activePreset && onExport(activePreset)}>
          Export JSON
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
