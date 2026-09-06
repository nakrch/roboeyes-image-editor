import { useRef, useState } from 'react'
import { clampGaze, type FaceModel } from '../../core/model'
import {
  builtInPresets,
  clonePreset,
  createCustomPreset,
  createUserExpressionPreset,
  expressionPresets,
  loadCustomExpressionPresets,
  loadCustomPresets,
  matchExpressionPreset,
  parseExpressionPreset,
  parsePreset,
  removeUserExpressionPreset,
  saveCustomExpressionPresets,
  saveCustomPresets,
  serializeExpressionPreset,
  serializePreset,
  type ExpressionPreset,
  type FacePreset,
  type UserExpressionPreset,
} from '../../core/presets'
import { ExpressionPresetPanel } from '../controls/ExpressionPresetPanel'
import { ParameterPanel } from '../controls/ParameterPanel'
import { PresetPanel } from '../controls/PresetPanel'
import { ExportPanel } from '../export/ExportPanel'
import { PreviewArea } from '../preview/PreviewArea'
import { ContinuousEditProvider } from './continuousEdit'
import { commitHistory, redoHistory, undoHistory, type HistoryState } from './history'

type EditorSnapshot = {
  model: FaceModel
  transparentBackground: boolean
}

type SelectableExpressionPreset = ExpressionPreset | UserExpressionPreset

const HISTORY_LIMIT = 100
const initialPreset = builtInPresets[0]

function snapshotFromPreset(preset: FacePreset): EditorSnapshot {
  return {
    model: clampGaze(structuredClone(preset.model)),
    transparentBackground: preset.preview?.transparentBackground ?? false,
  }
}

function expressionEqual(a: FaceModel['expression'], b: FaceModel['expression']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function EditorShell() {
  const [history, setHistory] = useState<HistoryState<EditorSnapshot>>(() => ({
    past: [],
    present: snapshotFromPreset(initialPreset),
    future: [],
  }))
  const continuousEdit = useRef({ active: false, committed: false })
  const [linkedEyes, setLinkedEyes] = useState(true)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const [activePresetId, setActivePresetId] = useState(initialPreset.id)
  const [activeExpressionPresetId, setActiveExpressionPresetId] = useState(() =>
    matchExpressionPreset(initialPreset.model.expression),
  )
  const [customPresets, setCustomPresets] = useState<FacePreset[]>(() => loadCustomPresets(window.localStorage))
  const [customExpressionPresets, setCustomExpressionPresets] = useState<UserExpressionPreset[]>(() =>
    loadCustomExpressionPresets(window.localStorage),
  )
  const [presetError, setPresetError] = useState('')
  const [expressionPresetError, setExpressionPresetError] = useState('')
  const [expressionPresetStatus, setExpressionPresetStatus] = useState('')
  const presets: FacePreset[] = [...builtInPresets.map(clonePreset), ...customPresets]
  const selectableExpressions: SelectableExpressionPreset[] = [...expressionPresets, ...customExpressionPresets]

  const beginContinuousEdit = () => {
    if (continuousEdit.current.active) return
    continuousEdit.current = { active: true, committed: false }
  }

  const endContinuousEdit = () => {
    continuousEdit.current = { active: false, committed: false }
  }

  const commit = (updater: (current: EditorSnapshot) => EditorSnapshot) => {
    const replacePresent = continuousEdit.current.active && continuousEdit.current.committed
    if (continuousEdit.current.active) continuousEdit.current.committed = true
    setHistory((current) => commitHistory(current, updater(current.present), HISTORY_LIMIT, replacePresent))
  }

  const updateModel = (updater: (current: FaceModel) => FaceModel) => {
    commit((current) => ({ ...current, model: clampGaze(updater(current.model)) }))
  }

  const undo = () => {
    endContinuousEdit()
    setHistory(undoHistory)
  }

  const redo = () => {
    endContinuousEdit()
    setHistory((current) => redoHistory(current, HISTORY_LIMIT))
  }

  const applyPreset = (preset: FacePreset) => {
    endContinuousEdit()
    setActivePresetId(preset.id)
    setActiveExpressionPresetId(matchExpressionPreset(preset.model.expression))
    setLinkedEyes(true)
    setPresetError('')
    commit(() => snapshotFromPreset(preset))
  }

  const reset = () => {
    endContinuousEdit()
    const preset = presets.find((item) => item.id === activePresetId) ?? initialPreset
    setActiveExpressionPresetId(matchExpressionPreset(preset.model.expression))
    setLinkedEyes(true)
    commit(() => snapshotFromPreset(preset))
  }

  const persistCustomPresets = (next: FacePreset[]) => {
    setCustomPresets(next)
    saveCustomPresets(window.localStorage, next)
  }

  const saveCurrentPreset = (name: string) => {
    const preset = createCustomPreset(name, history.present.model, history.present.transparentBackground)
    persistCustomPresets([...customPresets, preset])
    setActivePresetId(preset.id)
    setPresetError('')
  }

  const importPreset = (json: string) => {
    try {
      const imported = parsePreset(json)
      const preset: FacePreset = { ...clonePreset(imported), id: `custom:${crypto.randomUUID()}`, name: imported.name || 'Imported preset' }
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

  const persistExpressionPresets = (next: UserExpressionPreset[]) => {
    setCustomExpressionPresets(next)
    saveCustomExpressionPresets(window.localStorage, next)
  }

  const saveCurrentExpressionPreset = (name: string) => {
    const preset = createUserExpressionPreset(name, history.present.model.expression, selectableExpressions)
    persistExpressionPresets([...customExpressionPresets, preset])
    setActiveExpressionPresetId(preset.id)
    setExpressionPresetError('')
    setExpressionPresetStatus(`Saved “${preset.name}”.`)
  }

  const applyExpressionPreset = (preset: SelectableExpressionPreset) => {
    endContinuousEdit()
    setActiveExpressionPresetId(preset.id)
    setExpressionPresetError('')
    setExpressionPresetStatus('')
    commit((current) => ({
      ...current,
      model: { ...current.model, expression: structuredClone(preset.expression) },
    }))
  }

  const importExpressionPreset = (json: string) => {
    try {
      const imported = parseExpressionPreset(json)
      const preset = createUserExpressionPreset(
        imported.name,
        imported.expression,
        selectableExpressions,
      )
      persistExpressionPresets([...customExpressionPresets, preset])
      applyExpressionPreset(preset)
      setExpressionPresetStatus(`Imported “${preset.name}”.`)
    } catch {
      setExpressionPresetStatus('')
      setExpressionPresetError('Could not import expression preset: invalid or unsupported JSON.')
    }
  }

  const exportExpressionPreset = (preset: UserExpressionPreset) => {
    const blob = new Blob([serializeExpressionPreset(preset)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'expression'}.expression.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deleteExpressionPreset = (preset: UserExpressionPreset) => {
    persistExpressionPresets(removeUserExpressionPreset(customExpressionPresets, preset.id))
    if (activeExpressionPresetId === preset.id) setActiveExpressionPresetId('custom')
    setExpressionPresetError('')
    setExpressionPresetStatus(`Deleted “${preset.name}”.`)
  }

  const { model, transparentBackground } = history.present
  const activeExpressionPreset = selectableExpressions.find((preset) => preset.id === activeExpressionPresetId)
  const activeExpressionId = activeExpressionPreset && expressionEqual(activeExpressionPreset.expression, model.expression)
    ? activeExpressionPreset.id
    : matchExpressionPreset(model.expression)

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <p className="eyebrow">Parametric Robot Face Editor</p>
          <h1>RoboEyes Image Editor</h1>
        </div>
        <span className="phase-badge">Realtime SVG Editor</span>
      </header>

      <ContinuousEditProvider value={{ begin: beginContinuousEdit, end: endContinuousEdit }}>
        <section className="editor-workspace" aria-label="Editor workspace">
          <div className="editor-preview-column">
            <PreviewArea
              model={model}
              transparentBackground={transparentBackground}
              pixelPerfect={pixelPerfect}
              onTransparentBackgroundChange={(value) => commit((current) => ({ ...current, transparentBackground: value }))}
              onPixelPerfectChange={setPixelPerfect}
            />
            <div className="preview-history-actions" aria-label="Editor history">
              <button type="button" onClick={undo} disabled={history.past.length === 0}>Undo</button>
              <button type="button" onClick={redo} disabled={history.future.length === 0}>Redo</button>
              <button type="button" onClick={reset}>Reset</button>
            </div>
          </div>

          <div className="editor-sidebar">
            <PresetPanel presets={presets} activePresetId={activePresetId} onApply={applyPreset} onSaveCurrent={saveCurrentPreset} onImport={importPreset} onExport={exportPreset} />
            {presetError && <p className="preset-error" role="alert">{presetError}</p>}
            <ExpressionPresetPanel
              presets={selectableExpressions}
              activePresetId={activeExpressionId}
              status={expressionPresetStatus}
              onApply={applyExpressionPreset}
              onSaveCurrent={saveCurrentExpressionPreset}
              onImport={importExpressionPreset}
              onExport={exportExpressionPreset}
              onDelete={deleteExpressionPreset}
            />
            {expressionPresetError && <p className="preset-error" role="alert">{expressionPresetError}</p>}
            <ParameterPanel model={model} linkedEyes={linkedEyes} onChange={updateModel} onLinkedEyesChange={setLinkedEyes} />
            <ExportPanel model={model} transparentBackground={transparentBackground} />
          </div>
        </section>
      </ContinuousEditProvider>
    </main>
  )
}
