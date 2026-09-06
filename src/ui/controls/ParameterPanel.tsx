import { gazeLimits, minimumCanvasSize, type FaceModel } from '../../core/model'
import { setGazeSafely } from '../editor/gazeSafety'
import { resizeCanvasFromCenter } from '../editor/modelEditing'
import { EyeControls } from './EyeControls'
import { ExpressionControls } from './ExpressionControls'
import { NumericControl } from './NumericControl'

type ParameterPanelProps = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
}

const resolutionPresets = [
  { key: '128x64', width: 128, height: 64 },
  { key: '128x128', width: 128, height: 128 },
  { key: '240x240', width: 240, height: 240 },
  { key: '320x240', width: 320, height: 240 },
  { key: '320x320', width: 320, height: 320 },
] as const

const CANVAS_MIN = 16
const CANVAS_MAX = 640

export function ParameterPanel({
  model,
  linkedEyes,
  onChange,
  onLinkedEyesChange,
}: ParameterPanelProps) {
  const currentResolution =
    resolutionPresets.find(
      (preset) => preset.width === model.canvas.width && preset.height === model.canvas.height,
    )?.key ?? 'custom'
  const safeGaze = gazeLimits(model)
  const requiredCanvas = minimumCanvasSize(model)
  const minCanvasWidth = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(requiredCanvas.width)))
  const minCanvasHeight = Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, Math.ceil(requiredCanvas.height)))

  const applyResolution = (key: string) => {
    const preset = resolutionPresets.find((candidate) => candidate.key === key)
    if (preset) {
      onChange((current) => {
        const minimum = minimumCanvasSize(current)
        return resizeCanvasFromCenter(
          current,
          Math.max(preset.width, Math.ceil(minimum.width)),
          Math.max(preset.height, Math.ceil(minimum.height)),
        )
      })
    }
  }

  return (
    <aside className="panel parameter-panel" aria-label="Parameter controls">
      <div className="panel-heading control-panel-heading">
        <div>
          <p className="eyebrow">Parameters</p>
          <h2>Controls</h2>
        </div>
      </div>

      <div className="control-list">
        <details className="control-group collapsible-control-group" open>
          <summary className="control-group-summary">
            <span>Canvas</span>
            <select
              aria-label="Preview resolution preset"
              value={currentResolution}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => applyResolution(event.target.value)}
            >
              {resolutionPresets.map((preset) => (
                <option value={preset.key} key={preset.key}>
                  {preset.width} × {preset.height}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </summary>
          <div className="nested-controls control-group-body">
            <NumericControl
              label="Canvas width"
              value={model.canvas.width}
              min={minCanvasWidth}
              max={CANVAS_MAX}
              onChange={(value) =>
                onChange((current) => {
                  const minimum = Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(current).width))
                  return resizeCanvasFromCenter(current, Math.max(value, minimum), current.canvas.height)
                })
              }
            />
            <NumericControl
              label="Canvas height"
              value={model.canvas.height}
              min={minCanvasHeight}
              max={CANVAS_MAX}
              onChange={(value) =>
                onChange((current) => {
                  const minimum = Math.max(CANVAS_MIN, Math.ceil(minimumCanvasSize(current).height))
                  return resizeCanvasFromCenter(current, current.canvas.width, Math.max(value, minimum))
                })
              }
            />
          </div>
        </details>

        <EyeControls
          model={model}
          linkedEyes={linkedEyes}
          onChange={onChange}
          onLinkedEyesChange={onLinkedEyesChange}
        />

        <ExpressionControls model={model} linkedEyes={linkedEyes} onChange={onChange} />

        <details className="control-group collapsible-control-group" open>
          <summary className="control-group-summary">Gaze</summary>
          <div className="nested-controls control-group-body">
            <NumericControl
              label="Gaze X"
              value={model.gaze.x}
              min={safeGaze.x.min}
              max={safeGaze.x.max}
              step="any"
              onChange={(value) => onChange((current) => setGazeSafely(current, 'x', value))}
            />
            <NumericControl
              label="Gaze Y"
              value={model.gaze.y}
              min={safeGaze.y.min}
              max={safeGaze.y.max}
              step="any"
              onChange={(value) => onChange((current) => setGazeSafely(current, 'y', value))}
            />
          </div>
        </details>

        <details className="control-group collapsible-control-group" open>
          <summary className="control-group-summary">Appearance</summary>
          <div className="nested-controls control-group-body">
            <label className="control-field color-control">
              <span>Eye fill</span>
              <input type="color" value={model.colors.eye} onChange={(event) => onChange((current) => ({ ...current, colors: { ...current.colors, eye: event.target.value } }))} />
            </label>
            <label className="control-field color-control">
              <span>Eye stroke</span>
              <input type="color" value={model.colors.stroke ?? model.colors.eye} onChange={(event) => onChange((current) => ({ ...current, colors: { ...current.colors, stroke: event.target.value } }))} />
            </label>
            <label className="control-field color-control">
              <span>Background</span>
              <input type="color" value={model.colors.background} onChange={(event) => onChange((current) => ({ ...current, colors: { ...current.colors, background: event.target.value } }))} />
            </label>
          </div>
        </details>
      </div>
    </aside>
  )
}
