import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  builtInPresets,
  type ExpressionPreset,
  type UserExpressionPreset,
} from '../../core/presets'
import { renderFaceToSvg } from '../../renderers/svg'
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

const previewBaseModel = builtInPresets[0].model

function thumbnailIdPrefix(id: string): string {
  return `expression-thumbnail-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
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
    if (disabled) return
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
      notify('success', `Downloading “${preset.name}” JSON…`)
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
    <aside className="panel preset-panel expression-preset-panel" aria-label="Expression presets" aria-disabled={disabled}>
      <div className="panel-heading preset-dock-heading">
        <p className="eyebrow">Expression</p>
        <h2>Expression library</h2>
      </div>

      <div className="preset-thumbnail-strip" role="listbox" aria-label="Expression presets">
        {presets.map((preset) => {
          const selected = preset.id === activePresetId
          const svg = renderFaceToSvg(
            { ...previewBaseModel, expression: preset.expression },
            {
              transparentBackground: false,
              idPrefix: thumbnailIdPrefix(preset.id),
            },
          )
          return (
            <button
              type="button"
              className={`preset-thumbnail ${selected ? 'active' : ''}`}
              role="option"
              aria-selected={selected}
              key={preset.id}
              disabled={disabled}
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
          <select disabled={disabled} value={activePreset?.id ?? 'custom'} onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value)
            if (preset) applyPreset(preset)
          }}>
            <option value="custom" disabled>Custom</option>
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>

        <div className="preset-actions">
          <input
            disabled={disabled}
            className="number-input"
            type="text"
            placeholder="Expression preset name"
            value={name}
            aria-label="Expression preset name"
            onChange={(event) => setName(event.target.value)}
          />
          <button type="button" disabled={disabled} onClick={() => onSaveCurrent(name)}>Save expression</button>
        </div>

        <div className="preset-file-actions">
          <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>Import</button>
          <button type="button" disabled={disabled || !customPreset} onClick={() => customPreset && exportPreset(customPreset)}>Export JSON</button>
          <button type="button" disabled={disabled || !customPreset} onClick={() => customPreset && deletePreset(customPreset)}>Delete</button>
          <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" disabled={disabled} onChange={importFile} />
        </div>
      </div>

      {disabled && (
        <p className="animation-note">
          Single-eye mode is fixed to Neutral. Switch to Two eyes to select, save, import, or edit expressions.
        </p>
      )}

      {status && <p className="preset-status" role="status" aria-live="polite">{status}</p>}
    </aside>
  )
}
