import { useMemo } from 'react'
import type { FacePreset } from '../../core/presets'
import { renderFaceToSvg } from '../../renderers/svg'
import { ExpressionPresetPanel } from '../controls/ExpressionPresetPanel'
import { PresetPanel } from '../controls/PresetPanel'
import type { EditorController } from '../editor/useEditorController'
import { VisualRegressionGallery } from '../preview/VisualRegressionGallery'

function PresetThumbnail({ preset, selected, onApply }: {
  preset: FacePreset
  selected: boolean
  onApply: (preset: FacePreset) => void
}) {
  const svg = useMemo(() => renderFaceToSvg(preset.model, {
    transparentBackground: preset.preview?.transparentBackground,
    idPrefix: `re-preset-${preset.id}`,
  }), [preset])

  return (
    <button type="button" className="re-preset-thumbnail" aria-pressed={selected} onClick={() => onApply(preset)}>
      <span className="re-preset-image" style={{ aspectRatio: `${preset.model.canvas.width} / ${preset.model.canvas.height}` }} dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="re-preset-name">{preset.name}</span>
    </button>
  )
}

export function LibrarySection({ controller }: { controller: EditorController }) {
  return (
    <section className="re-section re-library" aria-labelledby="re-library-title">
      <header className="re-section-header">
        <h2 id="re-library-title">Library</h2>
        <p>Save a face, select an expression, or inspect the gallery.</p>
      </header>
      <div className="re-group">
        <h3 className="re-group-title">Face presets</h3>
        <div className="re-preset-grid">
          {controller.presets.map((preset) => (
            <PresetThumbnail key={preset.id} preset={preset} selected={controller.displayedPresetId === preset.id} onApply={controller.applyPreset} />
          ))}
        </div>
        <PresetPanel
          presets={controller.presets}
          activePresetId={controller.displayedPresetId}
          status={controller.presetStatus}
          onApply={controller.applyPreset}
          onSaveCurrent={controller.saveCurrentPreset}
          onImport={controller.importPreset}
          onExport={controller.exportPreset}
          onDelete={controller.deletePreset}
        />
        {controller.presetError && <p className="re-error" role="alert">{controller.presetError}</p>}
      </div>
      <div className="re-group">
        <h3 className="re-group-title">Expression presets</h3>
        <ExpressionPresetPanel
          presets={controller.selectableExpressions}
          activePresetId={controller.activeExpressionId}
          status={controller.expressionPresetStatus}
          disabled={controller.singleEye}
          onApply={controller.applyExpressionPreset}
          onSaveCurrent={controller.saveCurrentExpressionPreset}
          onImport={controller.importExpressionPreset}
          onExport={controller.exportExpressionPreset}
          onDelete={controller.deleteExpressionPreset}
        />
        {controller.expressionPresetError && <p className="re-error" role="alert">{controller.expressionPresetError}</p>}
      </div>
      <div className="re-group re-gallery-group">
        <h3 className="re-group-title">Expression gallery</h3>
        <VisualRegressionGallery activeExpressionId={controller.activeExpressionId} disabled={controller.singleEye} onApplySelection={controller.applyGallerySelection} />
      </div>
    </section>
  )
}
