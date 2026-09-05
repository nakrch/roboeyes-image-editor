import { useState } from 'react'
import { clampGaze, type FaceModel } from '../../core/model'
import {
  builtInPresets,
  clonePreset,
  createCustomPreset,
  loadCustomPresets,
  parsePreset,
  saveCustomPresets,
  serializePreset,
  type FacePreset,
} from '../../core/presets'
import { ParameterPanel } from '../controls/ParameterPanel'
import { PresetPanel } from '../controls/PresetPanel'
import { ExportPanel } from '../export/ExportPanel'
import { PreviewArea } from '../preview/PreviewArea'

type EditorSnapshot = {
  model: FaceModel
  transparentBackground: boolean
}

type HistoryState = {
  past: EditorSnapshot[]
  present: EditorSnapshot
  future: EditorSnapshot[]
}

const HISTORY_LIMIT = 100
const initialPreset = builtInPresets[0]

function snapshotFromPreset(preset: FacePreset): EditorSnapshot {
  return {
    model: clampGaze(structuredClone(preset.model)),
    transparentBackground: preset.preview?.transparentBackground ?? false,
  }
}

export function EditorShell() {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: snapshotFromPreset(initialPreset),
    future: [],
  }))
  const [linkedEyes, setLinkedEyes] = useState(true)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [customPresets, setCustomPresets] = useState<FacePreset[]>(() =>
    loadCustomPresets(window.localStorage),
  )
  const [presetError, setPresetError] = useState('')
  const presets: FacePreset[] = [...builtInPresets.map(clonePreset), ...customPresets]

  const commit = (updater: (current: EditorSnapshot) => EditorSnapshot) => {
    setHistory((current) => {
      const next = updater(current.present)
      if (next === current.present) return current

      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      }
    })
  }

  const updateModel = (updater: (current: FaceModel) => FaceModel) => {
    commit((current) => ({ ...current, model: clampGaze(updater(current.model)) }))
  }

  const undo = () => {
    setHistory((current) => {
      const previous = current.past.at(-1)
      if (!previous) return current
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      }
    })
  }

  const redo = () => {
    setHistory((current) => {
      const next = current.future[0]
      if (!next) return current
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: current.future.slice(1),
      }
    })
  }

  const applyPreset = (preset: FacePreset) => {
    setActivePresetId(preset.id)
    setLinkedEyes(true)
    setPresetError('')
    commit(() => snapshotFromPreset(preset))
  }

  const reset = () => {
    const preset = presets.find((item) => item.id === activePresetId) ?? initialPreset
    setLinkedEyes(true)
    commit(() => snapshotFromPreset(preset))
  }

  const persistCustomPresets = (next: FacePreset[]) => {
    setCustomPresets(next)
    saveCustomPresets(window.localStorage, next)
  }

  const saveCurrentPreset = (name: string) => {
    const preset = createCustomPreset(
      name,
      history.present.model,
      history.present.transparentBackground,
    )
    persistCustomPresets([...customPresets, preset])
    setActivePresetId(preset.id)
    setPresetError('')
  }

  const importPreset = (json: string) => {
    try {
      const imported = parsePreset(json)
      const preset: FacePreset = {
        ...clonePreset(imported),
        id: `custom:${crypto.randomUUID()}`,
        name: imported.name || 'Imported preset',
      }
      persistCustomPresets([...customPresets, preset])
      applyPreset(preset)
    } catch {
      setPresetError('Could not import preset: invalid or unsupported JSON.')
    }
  }

  const exportPreset = (preset: FacePreset) => {
    const blob = new Blob([serializePreset(preset)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'preset'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const { model, transparentBackground } = history.present

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <p className="eyebrow">Parametric Robot Face Editor</p>
          <h1>RoboEyes Image Editor</h1>
        </div>
        <span className="phase-badge">Realtime SVG Editor</span>
      </header>

      <section className="editor-workspace" aria-label="Editor workspace">
        <div className="editor-preview-column">
          <PreviewArea
            model={model}
            transparentBackground={transparentBackground}
            pixelPerfect={pixelPerfect}
            onTransparentBackgroundChange={(value) =>
              commit((current) => ({ ...current, transparentBackground: value }))
            }
            onPixelPerfectChange={setPixelPerfect}
          />
        </div>

        <div className="editor-sidebar">
          <PresetPanel
            presets={presets}
            activePresetId={activePresetId}
            onApply={applyPreset}
            onSaveCurrent={saveCurrentPreset}
            onImport={importPreset}
            onExport={exportPreset}
          />
          {presetError && <p className="preset-error" role="alert">{presetError}</p>}
          <ParameterPanel
            model={model}
            linkedEyes={linkedEyes}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onChange={updateModel}
            onLinkedEyesChange={setLinkedEyes}
            onUndo={undo}
            onRedo={redo}
            onReset={reset}
          />
          <ExportPanel model={model} transparentBackground={transparentBackground} />
        </div>
      </section>
    </main>
  )
}
