import { useMemo, useState } from 'react'
import { roboEyesToFaceModel, type RoboEyesParameters } from '../../core/adapters/roboeyes'
import { defaultRoboEyesPreset } from '../../core/presets/roboeyes'
import { ParameterPanel } from '../controls/ParameterPanel'
import { PreviewArea } from '../preview/PreviewArea'

export function EditorShell() {
  const [parameters, setParameters] = useState<RoboEyesParameters>({ ...defaultRoboEyesPreset })
  const [transparentBackground, setTransparentBackground] = useState(false)
  const [pixelPerfect, setPixelPerfect] = useState(false)
  const model = useMemo(() => roboEyesToFaceModel(parameters), [parameters])

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <p className="eyebrow">Parametric Robot Face Editor</p>
          <h1>RoboEyes Image Editor</h1>
        </div>
        <span className="phase-badge">SVG Preview</span>
      </header>

      <section className="editor-workspace" aria-label="Editor workspace">
        <ParameterPanel parameters={parameters} onChange={setParameters} />
        <PreviewArea
          model={model}
          transparentBackground={transparentBackground}
          pixelPerfect={pixelPerfect}
          onTransparentBackgroundChange={setTransparentBackground}
          onPixelPerfectChange={setPixelPerfect}
        />
      </section>
    </main>
  )
}
