import { gazeLimits, minimumCanvasSize } from '../../core/model'
import type { DisplayMask } from '../../core/model'
import { setGazeSafely } from '../editor/gazeSafety'
import { resizeCanvasFromCenter } from '../editor/modelEditing'
import type { EditorController } from '../editor/useEditorController'
import { EyeControls } from '../controls/EyeControls'
import { ExpressionControls } from '../controls/ExpressionControls'
import { NumericControl } from '../controls/NumericControl'
import { CANVAS_MAX, CANVAS_MIN, normalizeCanvasDimension, resolutionPresets } from '../editor/canvasDimensions'

type Props = { controller: EditorController }


export function DisplaySection({ controller }: Props) {
  const { model } = controller
  const minimum = minimumCanvasSize(model)
  const widthMin = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.width)))
  const heightMin = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(minimum.height)))
  const resolution = resolutionPresets.find((preset) => preset.width === model.canvas.width && preset.height === model.canvas.height)?.key ?? 'custom'

  return (
    <section className="re-section" aria-labelledby="re-display-title">
      <header className="re-section-header"><h2 id="re-display-title">Display</h2><p>Canvas and appearance</p></header>
      <div className="re-group">
        <h3 className="re-group-title">Dimensions</h3>
        <label className="re-row"><span>Size</span><select className="re-field" aria-label="Canvas resolution preset" value={resolution} onChange={(event) => {
          const preset = resolutionPresets.find((item) => item.key === event.target.value)
          if (!preset) return
          controller.updateModel((current) => {
            const required = minimumCanvasSize(current)
            return resizeCanvasFromCenter(current, Math.max(preset.width, Math.ceil(required.width)), Math.max(preset.height, Math.ceil(required.height)))
          })
        }}>
          {resolutionPresets.map((preset) => <option key={preset.key} value={preset.key}>{preset.width} × {preset.height}</option>)}
          <option value="custom">Custom</option>
        </select></label>
        <NumericControl label="Canvas width" value={model.canvas.width} min={widthMin} max={CANVAS_MAX} onChange={(value) => controller.updateModel((current) => resizeCanvasFromCenter(current, normalizeCanvasDimension(value, Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(current).width))), current.canvas.height))} />
        <NumericControl label="Canvas height" value={model.canvas.height} min={heightMin} max={CANVAS_MAX} onChange={(value) => controller.updateModel((current) => resizeCanvasFromCenter(current, current.canvas.width, normalizeCanvasDimension(value, Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(current).height)))))} />
      </div>
      <div className="re-group">
        <h3 className="re-group-title">Surface</h3>
        <label className="re-row"><span>Transparent</span><input type="checkbox" checked={controller.transparentBackground} onChange={(event) => controller.setTransparentBackground(event.target.checked)} /></label>
        <label className="re-row"><span>Display mask</span><select className="re-field" aria-label="Display mask" value={controller.displayMask} onChange={(event) => controller.setDisplayMask(event.target.value as DisplayMask)}><option value="none">None</option><option value="circle">Circle</option></select></label>
        <NumericControl label="Lens (sphere)" value={model.lens?.strength ?? 0} min={0} max={1} step={0.05} onChange={controller.setLensStrength} />
        <p className="re-status">Compresses eyes near the display edge.</p>
        <label className="re-row"><span>Pixel perfect</span><input type="checkbox" checked={controller.pixelPerfect} onChange={(event) => controller.setPixelPerfect(event.target.checked)} /></label>
        {([['eye', 'Eye fill'], ['stroke', 'Eye stroke'], ['background', 'Background']] as const).map(([key, label]) => (
          <label className="re-row re-color-row" key={key}><span>{label}</span><input type="color" value={model.colors[key] ?? model.colors.eye} onChange={(event) => controller.updateModel((current) => ({ ...current, colors: { ...current.colors, [key]: event.target.value } }))} /><span className="re-color-value">{model.colors[key] ?? model.colors.eye}</span></label>
        ))}
      </div>
    </section>
  )
}

export function EyesSection({ controller }: Props) {
  const gaze = gazeLimits(controller.model)
  return (
    <section className="re-section" aria-labelledby="re-eyes-title">
      <header className="re-section-header"><h2 id="re-eyes-title">Eyes</h2><p>Geometry, position and gaze</p></header>
      <EyeControls model={controller.model} linkedEyes={controller.linkedEyes} rotationPivot={controller.rotationPivot} onRotationPivotChange={controller.setRotationPivot} onChange={controller.updateModel} onLinkedEyesChange={controller.setLinkedEyes} onSingleEyeLayoutChange={controller.setSingleEyeLayout} />
      <div className="re-group"><h3 className="re-group-title">Gaze</h3>
        <NumericControl label="Gaze X" value={controller.model.gaze.x} min={gaze.x.min} max={gaze.x.max} step="any" onChange={(value) => controller.updateModel((current) => setGazeSafely(current, 'x', value))} />
        <NumericControl label="Gaze Y" value={controller.model.gaze.y} min={gaze.y.min} max={gaze.y.max} step="any" onChange={(value) => controller.updateModel((current) => setGazeSafely(current, 'y', value))} />
      </div>
    </section>
  )
}

export function ExpressionSection({ controller }: Props) {
  return (
    <section className="re-section" aria-labelledby="re-expression-title">
      <header className="re-section-header"><h2 id="re-expression-title">Expression</h2><p>Shape the character of the face</p></header>
      <div className="re-group"><h3 className="re-group-title">Quick expressions</h3>
        {controller.singleEye ? <p className="re-status">Switch to Two eyes in Eyes to edit expressions.</p> : <div className="re-expression-list">
          {controller.selectableExpressions.map((preset) => <button type="button" key={preset.id} className="re-button re-button--quiet" aria-pressed={controller.activeExpressionId === preset.id} onClick={() => controller.applyExpressionPreset(preset)}>{preset.name}</button>)}
        </div>}
      </div>
      <ExpressionControls model={controller.model} linkedEyes={controller.linkedEyes} disabled={controller.singleEye} onChange={controller.updateModel} />
    </section>
  )
}
