import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { FacePreset } from '../../core/presets'
import { renderFaceToSvg } from '../../renderers/svg'
import { useToast } from '../feedback/ToastProvider'

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

function thumbnailIdPrefix(id: string): string {
  return `face-thumbnail-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
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
  const { notify } = useToast()
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

  const applyPreset = (preset: FacePreset) => {
    try {
      onApply(preset)
      notify('success', `Applied “${preset.name}”.`)
    } catch {
      notify('error', `Could not apply “${preset.name}”.`)
    }
  }

  const exportPreset = (preset: FacePreset) => {
    try {
      onExport(preset)
      notify('success', `Downloading “${preset.name}” JSON…`)
    } catch {
      notify('error', `Could not export “${preset.name}”.`)
    }
  }

  const deletePreset = (preset: FacePreset) => {
    try {
      onDelete(preset)
      notify('success', `Deleted “${preset.name}”.`)
    } catch {
      notify('error', `Could not delete “${preset.name}”.`)
    }
  }

  return (
    <aside className="panel preset-panel" aria-label="Presets">
      <div className="panel-heading preset-dock-heading">
        <p className="eyebrow">Presets</p>
        <h2>Face library</h2>
      </div>

      <div className="preset-thumbnail-strip" role="listbox" aria-label="Face presets">
        {presets.map((preset) => {
          const selected = preset.id === activePresetId
          const svg = renderFaceToSvg(preset.model, {
            transparentBackground: preset.preview?.transparentBackground ?? false,
            idPrefix: thumbnailIdPrefix(preset.id),
          })
          return (
            <button
              type="button"
              className={`preset-thumbnail ${selected ? 'active' : ''}`}
              role="option"
              aria-selected={selected}
              key={preset.id}
              onClick={() => applyPreset(preset)}
            >
              <span
                className="preset-thumbnail-preview"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <span className="preset-thumbnail-label">{preset.name}</span>
            </button>
          )
        })}
      </div>

      <div className="preset-management">
        <label className="control-field preset-select-field">
          <span>Selected</span>
          <select
            value={activePreset?.id ?? 'custom'}
            onChange={(event) => {
              const preset = presets.find((item) => item.id === event.target.value)
              if (preset) applyPreset(preset)
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
            aria-label="Custom preset name"
            onChange={(event) => setName(event.target.value)}
          />
          <button type="button" onClick={() => onSaveCurrent(name)}>
            Save current
          </button>
        </div>

        <div className="preset-file-actions">
          <button type="button" onClick={() => inputRef.current?.click()}>
            Import
          </button>
          <button type="button" disabled={!customPreset} onClick={() => customPreset && exportPreset(customPreset)}>
            Export JSON
          </button>
          <button type="button" disabled={!customPreset} onClick={() => customPreset && deletePreset(customPreset)}>
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
      </div>

      {status && <p className="preset-status" role="status" aria-live="polite">{status}</p>}
    </aside>
  )
}
