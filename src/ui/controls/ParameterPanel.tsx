import { gazeLimits, type FaceModel } from '../../core/model'
import { resizeCanvasFromCenter } from '../editor/modelEditing'
import { EyeControls } from './EyeControls'
import { ExpressionControls } from './ExpressionControls'
import { NumericControl } from './NumericControl'

type ParameterPanelProps = {
  model: FaceModel
  linkedEyes: boolean
  canUndo: boolean
  canRedo: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
}

const resolutionPresets = [
  { key: '128x64', width: 128, height: 64 },
  { key: '128x128', width: 128, height: 128 },
  { key: '240x240', width: 240, height: 240 },
  { key: '320x240', width: 320, height: 240 },
  { key: '320x320', width: 320, height: 320 },
] as const

export function ParameterPanel({
  model,
  linkedEyes,
  canUndo,
  canRedo,
  onChange,
  onLinkedEyesChange,
  onUndo,
  onRedo,
  onReset,
}: ParameterPanelProps) {
  const currentResolution =
    resolutionPresets.find(
      (preset) => preset.width === model.canvas.width && preset.height === model.canvas.height,
    )?.key ?? 'custom'
  const safeGaze = gazeLimits(model)

  const applyResolution = (key: string) => {
    const preset = resolutionPresets.find((candidate) => candidate.key === key)
    if (preset) {
      onChange((current) => resizeCanvasFromCenter(current, preset.width, preset.height))
    }
  }

  return (
    <aside className="panel parameter-panel" aria-label="Parameter controls">
      <div className="panel-heading control-panel-heading">
        <div>
          <p className="eyebrow">Parameters</p>
          <h2>Controls</h2>
        </div>
        <div className="history-actions" aria-label="Editor history">
          <button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>Redo</button>
          <button type="button" onClick={onReset}>Reset</button>
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
              min={16}
              max={640}
              onChange={(value) =>
                onChange((current) =>
                  resizeCanvasFromCenter(current, value, current.canvas.height),
                )
              }
            />
            <NumericControl
              label="Canvas height"
              value={model.canvas.height}
              min={16}
              max={640}
              onChange={(value) =>
                onChange((current) =>
                  resizeCanvasFromCenter(current, current.canvas.width, value),
                )
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
              onChange={(value) => onChange((current) => ({ ...current, gaze: { ...current.gaze, x: value } }))}
            />
            <NumericControl
              label="Gaze Y"
              value={model.gaze.y}
              min={safeGaze.y.min}
              max={safeGaze.y.max}
              step="any"
              onChange={(value) => onChange((current) => ({ ...current, gaze: { ...current.gaze, y: value } }))}
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
