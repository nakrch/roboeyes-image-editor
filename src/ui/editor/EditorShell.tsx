import { AnimationPanel } from '../controls/AnimationPanel'
import { ExpressionPresetPanel } from '../controls/ExpressionPresetPanel'
import { ParameterPanel } from '../controls/ParameterPanel'
import { PresetPanel } from '../controls/PresetPanel'
import { ExportPanel } from '../export/ExportPanel'
import { PreviewArea } from '../preview/PreviewArea'
import { VisualRegressionGallery } from '../preview/VisualRegressionGallery'
import { ContinuousEditProvider } from './continuousEdit'
import { useEditorController } from './useEditorController'

export function EditorShell() {
  const controller = useEditorController()
  const { model, transparentBackground, animationDefaults, displayedModel, displayedOverlays,
    resolveAnimationFrame, pixelPerfect, canUndo, canRedo, undo, redo, reset, continuousEdit,
    playback, reducedMotion, updateAnimationDefaults, play, pause, stop, restart, setPlaybackRate,
    triggerAnimation, previewSequenceStep, presets, displayedPresetId, presetStatus, presetError,
    applyPreset, saveCurrentPreset, importPreset, exportPreset, deletePreset, selectableExpressions,
    activeExpressionId, expressionPresetStatus, expressionPresetError, singleEye, applyExpressionPreset,
    saveCurrentExpressionPreset, importExpressionPreset, exportExpressionPreset, deleteExpressionPreset,
    linkedEyes, updateModel, setLinkedEyes, setSingleEyeLayout, setTransparentBackground,
    setPixelPerfect, applyGallerySelection,
  } = controller

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div><p className="eyebrow">Parametric Robot Face Editor</p><h1>RoboEyes Image Editor</h1></div>
        <span className="phase-badge">Realtime SVG + Animation</span>
      </header>

      <ContinuousEditProvider value={continuousEdit}>
        <section className="editor-workspace" aria-label="Editor workspace">
          <div className="editor-preview-column">
            <PreviewArea model={displayedModel} overlays={displayedOverlays} transparentBackground={transparentBackground} pixelPerfect={pixelPerfect} />
            <div className="preview-history-actions" aria-label="Editor history">
              <button type="button" onClick={undo} disabled={!canUndo}>Undo</button>
              <button type="button" onClick={redo} disabled={!canRedo}>Redo</button>
              <button type="button" onClick={reset}>Reset</button>
            </div>
          </div>

          <div className="editor-sidebar">
            <AnimationPanel model={model} animationDefaults={animationDefaults} playback={playback} reducedMotion={reducedMotion} onAnimationDefaultsChange={updateAnimationDefaults} onPlay={play} onPause={pause} onStop={stop} onRestart={restart} onPlaybackRateChange={setPlaybackRate} onTrigger={triggerAnimation} onPreviewSequenceStep={previewSequenceStep} />
            <PresetPanel presets={presets} activePresetId={displayedPresetId} status={presetStatus} onApply={applyPreset} onSaveCurrent={saveCurrentPreset} onImport={importPreset} onExport={exportPreset} onDelete={deletePreset} />
            {presetError && <p className="preset-error" role="alert">{presetError}</p>}
            <ExpressionPresetPanel presets={selectableExpressions} activePresetId={activeExpressionId} status={expressionPresetStatus} disabled={singleEye} onApply={applyExpressionPreset} onSaveCurrent={saveCurrentExpressionPreset} onImport={importExpressionPreset} onExport={exportExpressionPreset} onDelete={deleteExpressionPreset} />
            {expressionPresetError && <p className="preset-error" role="alert">{expressionPresetError}</p>}
            <ParameterPanel model={model} linkedEyes={linkedEyes} transparentBackground={transparentBackground} pixelPerfect={pixelPerfect} onChange={updateModel} onLinkedEyesChange={setLinkedEyes} onSingleEyeLayoutChange={setSingleEyeLayout} onTransparentBackgroundChange={setTransparentBackground} onPixelPerfectChange={setPixelPerfect} />
            <ExportPanel model={model} transparentBackground={transparentBackground} resolveAnimationFrame={resolveAnimationFrame} />
          </div>
        </section>
      </ContinuousEditProvider>

      <VisualRegressionGallery
        activeExpressionId={activeExpressionId}
        disabled={singleEye}
        onApplySelection={applyGallerySelection}
      />
    </main>
  )
}