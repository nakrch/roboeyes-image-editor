import { ParameterPanel } from '../controls/ParameterPanel'
import { PreviewArea } from '../preview/PreviewArea'

export function EditorShell() {
  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div>
          <p className="eyebrow">Parametric Robot Face Editor</p>
          <h1>RoboEyes Image Editor</h1>
        </div>
        <span className="phase-badge">Foundation</span>
      </header>

      <section className="editor-workspace" aria-label="Editor workspace">
        <ParameterPanel />
        <PreviewArea />
      </section>
    </main>
  )
}
