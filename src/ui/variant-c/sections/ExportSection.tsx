import { ExportPanel } from '../../export/ExportPanel'
import type { EditorController } from '../../editor/useEditorController'
import '../variant-c-sections.css'

export function ExportSection({ controller }: { controller: EditorController }) {
  return (
    <section className="vc-section vc-export" aria-labelledby="vc-export-title">
      <header className="vc-section-header">
        <h2 id="vc-export-title">Export</h2>
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
