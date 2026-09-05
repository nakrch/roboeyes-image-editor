import { resolveEyeExpression, type FaceModel, type EyeExpression } from '../../core/model'
import { expressionPresets, matchExpressionPreset } from '../../core/presets'
import { NumericControl } from './NumericControl'

type Props = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
}

const fields: Array<{ key: keyof EyeExpression; label: string; min: number; max: number; step?: number }> = [
  { key: 'upperLid', label: 'Upper lid', min: 0, max: 1, step: 0.05 },
  { key: 'lowerLid', label: 'Lower lid', min: 0, max: 1, step: 0.05 },
  { key: 'tilt', label: 'Expression tilt', min: -30, max: 30 },
]

export function ExpressionControls({ model, linkedEyes, onChange }: Props) {
  const applyPreset = (id: string) => {
    const preset = expressionPresets.find((item) => item.id === id)
    if (!preset) return
    onChange((current) => ({ ...current, expression: structuredClone(preset.expression) }))
  }

  const updateShared = (key: keyof EyeExpression, value: number) => {
    onChange((current) => ({
      ...current,
      expression: {
        ...current.expression,
        [key]: value,
        leftEye: undefined,
        rightEye: undefined,
      },
    }))
  }

  const updateSide = (side: 'left' | 'right', key: keyof EyeExpression, value: number) => {
    onChange((current) => {
      const property = side === 'left' ? 'leftEye' : 'rightEye'
      return {
        ...current,
        expression: {
          ...current.expression,
          [property]: { ...current.expression[property], [key]: value },
        },
      }
    })
  }

  return (
    <details className="control-group collapsible-control-group" open>
      <summary className="control-group-summary">
        <span>Expression</span>
        <select
          aria-label="Expression preset"
          value={matchExpressionPreset(model.expression)}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => applyPreset(event.target.value)}
        >
          {expressionPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          <option value="custom">Custom</option>
        </select>
      </summary>
      <div className="nested-controls control-group-body">
        {linkedEyes ? fields.map((field) => (
          <NumericControl
            key={field.key}
            label={field.label}
            value={model.expression[field.key] as number}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(value) => updateShared(field.key, value)}
          />
        )) : (
          <div className="eye-columns">
            {(['left', 'right'] as const).map((side) => {
              const expression = resolveEyeExpression(model.expression, side)
              return (
                <fieldset className="eye-fieldset" key={side}>
                  <legend>{side === 'left' ? 'Left eye expression' : 'Right eye expression'}</legend>
                  {fields.map((field) => (
                    <NumericControl
                      key={field.key}
                      label={field.label}
                      value={expression[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={(value) => updateSide(side, field.key, value)}
                    />
                  ))}
                </fieldset>
              )
            })}
          </div>
        )}
      </div>
    </details>
  )
}
