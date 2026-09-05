import { useState } from 'react'
import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import type { FaceModel } from '../../core/model'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { ParameterPanel } from '../controls/ParameterPanel'
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

function createPresetSnapshot(): EditorSnapshot {
  return {
    model: roboEyesToFaceModel(defaultRoboEyesPreset),
    transparentBackground: false,
  }
}

export function EditorShell() {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: createPresetSnapshot(),
    future: [],
  }))
  const [linkedEyes, setLinkedEyes] = useState(true)
  const [pixelPerfect, setPixelPerfect] = useState(false)

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
    commit((current) => ({ ...current, model: updater(current.model) }))
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

  const reset = () => {
    setLinkedEyes(true)
    commit(() => createPresetSnapshot())
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
        <PreviewArea
          model={model}
          transparentBackground={transparentBackground}
          pixelPerfect={pixelPerfect}
          onTransparentBackgroundChange={(value) =>
            commit((current) => ({ ...current, transparentBackground: value }))
          }
          onPixelPerfectChange={setPixelPerfect}
        />
      </section>
    </main>
  )
}
