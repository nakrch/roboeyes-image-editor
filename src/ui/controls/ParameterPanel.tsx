import type { Dispatch, SetStateAction } from 'react'
import type { RoboEyesParameters } from '../../core/adapters/roboeyes'

type ParameterPanelProps = {
  parameters: RoboEyesParameters
  onChange: Dispatch<SetStateAction<RoboEyesParameters>>
}

type NumericKey = {
  [K in keyof RoboEyesParameters]: RoboEyesParameters[K] extends number ? K : never
}[keyof RoboEyesParameters]

const numericControls: Array<{
  key: NumericKey
  label: string
  min: number
  max: number
  step?: number
}> = [
  { key: 'canvasWidth', label: 'Canvas width', min: 16, max: 640 },
  { key: 'canvasHeight', label: 'Canvas height', min: 16, max: 640 },
  { key: 'eyeWidth', label: 'Eye width', min: 1, max: 160 },
  { key: 'eyeHeight', label: 'Eye height', min: 1, max: 160 },
  { key: 'eyeRadius', label: 'Corner radius', min: 0, max: 80 },
  { key: 'eyeSpacing', label: 'Eye spacing', min: 0, max: 160 },
  { key: 'gazeX', label: 'Gaze X', min: -64, max: 64 },
  { key: 'gazeY', label: 'Gaze Y', min: -64, max: 64 },
  { key: 'rotation', label: 'Rotation', min: -45, max: 45 },
  { key: 'upperLid', label: 'Upper lid', min: 0, max: 1, step: 0.05 },
  { key: 'lowerLid', label: 'Lower lid', min: 0, max: 1, step: 0.05 },
  { key: 'expressionTilt', label: 'Expression tilt', min: -30, max: 30 },
]

export function ParameterPanel({ parameters, onChange }: ParameterPanelProps) {
  const updateNumber = (key: NumericKey, value: number) => {
    onChange((current) => ({ ...current, [key]: value }))
  }

  return (
    <aside className="panel parameter-panel" aria-label="Parameter controls">
      <div className="panel-heading">
        <p className="eyebrow">Parameters</p>
        <h2>Controls</h2>
      </div>

      <div className="control-list">
        {numericControls.map(({ key, label, min, max, step = 1 }) => (
          <label className="control-field" key={key}>
            <span>{label}</span>
            <div className="control-inputs">
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={parameters[key] as number}
                onChange={(event) => updateNumber(key, Number(event.target.value))}
              />
              <input
                className="number-input"
                type="number"
                min={min}
                max={max}
                step={step}
                value={parameters[key] as number}
                onChange={(event) => updateNumber(key, Number(event.target.value))}
              />
            </div>
          </label>
        ))}

        <label className="control-field color-control">
          <span>Eye color</span>
          <input
            type="color"
            value={parameters.eyeColor}
            onChange={(event) =>
              onChange((current) => ({ ...current, eyeColor: event.target.value }))
            }
          />
        </label>

        <label className="control-field color-control">
          <span>Background</span>
          <input
            type="color"
            value={parameters.backgroundColor}
            onChange={(event) =>
              onChange((current) => ({ ...current, backgroundColor: event.target.value }))
            }
          />
        </label>
      </div>
    </aside>
  )
}
