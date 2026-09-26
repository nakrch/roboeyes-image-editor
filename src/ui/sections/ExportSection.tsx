import { ExportPanel } from '../export/ExportPanel'
import type { EditorController } from '../editor/useEditorController'

export function ExportSection({ controller }: { controller: EditorController }) {
  return (
    <section className="re-section re-export" aria-labelledby="re-export-title">
      <header className="re-section-header">
        <h2 id="re-export-title">Export</h2>
        <p>Precise assets from the current canvas and timeline.</p>
      </header>
      <ExportPanel
        model={controller.model}
        transparentBackground={controller.transparentBackground}
        resolveAnimationFrame={controller.resolveAnimationFrame}
      />
    </section>
  )
}
