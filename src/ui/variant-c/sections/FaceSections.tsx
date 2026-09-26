import { gazeLimits, minimumCanvasSize } from '../../../core/model'
import { setGazeSafely } from '../../editor/gazeSafety'
import { resizeCanvasFromCenter } from '../../editor/modelEditing'
import type { EditorController } from '../../editor/useEditorController'
import { EyeControls } from '../../controls/EyeControls'
import { ExpressionControls } from '../../controls/ExpressionControls'
import { NumericControl } from '../../controls/NumericControl'
import { normalizeCanvasDimension } from '../../controls/ParameterPanel'
import '../variant-c-face.css'

type Props = { controller: EditorController }

const resolutions = [
  { key: '128x64', width: 128, height: 64 },
  { key: '128x128', width: 128, height: 128 },
  { key: '240x240', width: 240, height: 240 },
  { key: '320x240', width: 320, height: 240 },
  { key: '320x320', width: 320, height: 320 },
] as const

export function DisplaySection({ controller }: Props) {
  const { model } = controller
  const minimum = minimumCanvasSize(model)
  const widthMin = Math.min(640, Math.max(16, Math.ceil(minimum.width)))
  const heightMin = Math.min(640, Math.max(16, Math.ceil(minimum.height)))
  const resolution = resolutions.find((preset) => preset.width === model.canvas.width && preset.height === model.canvas.height)?.key ?? 'custom'

  return (
    <section className="vc-section" aria-labelledby="vc-display-title">
      <header className="vc-section-header"><h2 id="vc-display-title">Display</h2><p>Canvas and appearance</p></header>
      <div className="vc-group">
        <h3 className="vc-group-title">Dimensions</h3>
        <label className="vc-row"><span>Size</span><select className="vc-field" aria-label="Canvas resolution preset" value={resolution} onChange={(event) => {
          const preset = resolutions.find((item) => item.key === event.target.value)
          if (!preset) return
          controller.updateModel((current) => {
            const required = minimumCanvasSize(current)
            return resizeCanvasFromCenter(current, Math.max(preset.width, Math.ceil(required.width)), Math.max(preset.height, Math.ceil(required.height)))
          })
        }}>
          {resolutions.map((preset) => <option key={preset.key} value={preset.key}>{preset.width} × {preset.height}</option>)}
          <option value="custom">Custom</option>
        </select></label>
        <NumericControl label="Canvas width" value={model.canvas.width} min={widthMin} max={640} onChange={(value) => controller.updateModel((current) => resizeCanvasFromCenter(current, normalizeCanvasDimension(value, Math.max(16, Math.ceil(minimumCanvasSize(current).width))), current.canvas.height))} />
        <NumericControl label="Canvas height" value={model.canvas.height} min={heightMin} max={640} onChange={(value) => controller.updateModel((current) => resizeCanvasFromCenter(current, current.canvas.width, normalizeCanvasDimension(value, Math.max(16, Math.ceil(minimumCanvasSize(current).height)))))} />
      </div>
      <div className="vc-group">
        <h3 className="vc-group-title">Surface</h3>
        <label className="vc-row"><span>Transparent</span><input type="checkbox" checked={controller.transparentBackground} onChange={(event) => controller.setTransparentBackground(event.target.checked)} /></label>
        <label className="vc-row"><span>Pixel perfect</span><input type="checkbox" checked={controller.pixelPerfect} onChange={(event) => controller.setPixelPerfect(event.target.checked)} /></label>
        {([['eye', 'Eye fill'], ['stroke', 'Eye stroke'], ['background', 'Background']] as const).map(([key, label]) => (
          <label className="vc-row vc-color-row" key={key}><span>{label}</span><input type="color" value={model.colors[key] ?? model.colors.eye} onChange={(event) => controller.updateModel((current) => ({ ...current, colors: { ...current.colors, [key]: event.target.value } }))} /><span className="vc-color-value">{model.colors[key] ?? model.colors.eye}</span></label>
        ))}
      </div>
    </section>
  )
}

export function EyesSection({ controller }: Props) {
  const gaze = gazeLimits(controller.model)
  return (
    <section className="vc-section" aria-labelledby="vc-eyes-title">
      <header className="vc-section-header"><h2 id="vc-eyes-title">Eyes</h2><p>Geometry, position and gaze</p></header>
      <EyeControls model={controller.model} linkedEyes={controller.linkedEyes} onChange={controller.updateModel} onLinkedEyesChange={controller.setLinkedEyes} onSingleEyeLayoutChange={controller.setSingleEyeLayout} />
      <div className="vc-group"><h3 className="vc-group-title">Gaze</h3>
        <NumericControl label="Gaze X" value={controller.model.gaze.x} min={gaze.x.min} max={gaze.x.max} step="any" onChange={(value) => controller.updateModel((current) => setGazeSafely(current, 'x', value))} />
        <NumericControl label="Gaze Y" value={controller.model.gaze.y} min={gaze.y.min} max={gaze.y.max} step="any" onChange={(value) => controller.updateModel((current) => setGazeSafely(current, 'y', value))} />
      </div>
    </section>
  )
}

export function ExpressionSection({ controller }: Props) {
  return (
    <section className="vc-section" aria-labelledby="vc-expression-title">
      <header className="vc-section-header"><h2 id="vc-expression-title">Expression</h2><p>Shape the character of the face</p></header>
      <div className="vc-group"><h3 className="vc-group-title">Quick expressions</h3>
        {controller.singleEye ? <p className="vc-status">Switch to Two eyes in Eyes to edit expressions.</p> : <div className="vc-expression-list">
          {controller.selectableExpressions.map((preset) => <button type="button" key={preset.id} className="vc-button vc-button--quiet" aria-pressed={controller.activeExpressionId === preset.id} onClick={() => controller.applyExpressionPreset(preset)}>{preset.name}</button>)}
        </div>}
      </div>
      <ExpressionControls model={controller.model} linkedEyes={controller.linkedEyes} disabled={controller.singleEye} onChange={controller.updateModel} />
    </section>
  )
}
