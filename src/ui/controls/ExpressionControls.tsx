import { resolveEyeExpression, type FaceModel, type EyeExpression } from '../../core/model'
import { expressionPresets, matchExpressionPreset } from '../../core/presets'
import {
  isExpressionGeometryKey,
  isLidKey,
  setSharedExpressionGeometrySafely,
  setSharedLidSafely,
  sharedExpressionGeometryRange,
  translatePairToKeepCurrentGaze,
} from '../editor/geometrySafety'
import {
  independentExpressionGeometryRange,
  setIndependentExpressionGeometrySafely,
  setIndependentLidSafely,
} from '../editor/independentExpressionSafety'
import {
  isDirectionalLidKey,
  setIndependentDirectionalLidSafely,
  setSharedDirectionalLidSafely,
} from '../editor/directionalLidSafety'
import {
  isGazeReactiveKey,
  setIndependentGazeReactiveSafely,
  setSharedGazeReactiveSafely,
} from '../editor/gazeReactiveSafety'
import { NumericControl } from './NumericControl'

type Props = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
}

const fields: Array<{ key: keyof EyeExpression; label: string; min: number; max: number; step?: number | 'any' }> = [
  { key: 'upperLid', label: 'Upper lid', min: 0, max: 1, step: 0.05 },
  { key: 'upperLidInner', label: 'Upper lid inner offset', min: 0, max: 1, step: 0.05 },
  { key: 'upperLidOuter', label: 'Upper lid outer offset', min: 0, max: 1, step: 0.05 },
  { key: 'lowerLid', label: 'Lower lid', min: 0, max: 1, step: 0.05 },
  { key: 'lowerLidCurvature', label: 'Lower lid curvature', min: 0, max: 1, step: 0.05 },
  { key: 'tilt', label: 'Expression tilt', min: -30, max: 30, step: 'any' },
  { key: 'heightScale', label: 'Eye height scale', min: 0.5, max: 1.5, step: 'any' },
  { key: 'gazeHeightExpansion', label: 'Gaze height expansion', min: 0, max: 1, step: 0.05 },
  { key: 'gazeHeightThreshold', label: 'Gaze height threshold', min: 0, max: 1, step: 0.05 },
]

function sharedValue(expression: FaceModel['expression'], key: keyof EyeExpression): number {
  if (key === 'heightScale') return expression.heightScale ?? 1
  if (key === 'upperLidInner') return expression.upperLidInner ?? 0
  if (key === 'upperLidOuter') return expression.upperLidOuter ?? 0
  if (key === 'lowerLidCurvature') return expression.lowerLidCurvature ?? 0
  if (key === 'gazeHeightExpansion') return expression.gazeHeightExpansion ?? 0
  if (key === 'gazeHeightThreshold') return expression.gazeHeightThreshold ?? 0.15
  return expression[key] as number
}

export function ExpressionControls({ model, linkedEyes, onChange }: Props) {
  const applyPreset = (id: string) => {
    const preset = expressionPresets.find((item) => item.id === id)
    if (!preset) return
    onChange((current) =>
      translatePairToKeepCurrentGaze({
        ...current,
        expression: structuredClone(preset.expression),
      }),
    )
  }

  const updateShared = (key: keyof EyeExpression, value: number) => {
    if (isExpressionGeometryKey(key)) {
      onChange((current) => setSharedExpressionGeometrySafely(current, key, value))
      return
    }

    if (isGazeReactiveKey(key)) {
      onChange((current) => setSharedGazeReactiveSafely(current, key, value))
      return
    }

    if (isDirectionalLidKey(key)) {
      onChange((current) => setSharedDirectionalLidSafely(current, key, value))
      return
    }

    if (isLidKey(key)) {
      onChange((current) => setSharedLidSafely(current, key, value))
      return
    }

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
    if (isExpressionGeometryKey(key)) {
      onChange((current) => setIndependentExpressionGeometrySafely(current, side, key, value))
      return
    }

    if (isGazeReactiveKey(key)) {
      onChange((current) => setIndependentGazeReactiveSafely(current, side, key, value))
      return
    }

    if (isDirectionalLidKey(key)) {
      onChange((current) => setIndependentDirectionalLidSafely(current, side, key, value))
      return
    }

    if (isLidKey(key)) {
      onChange((current) => setIndependentLidSafely(current, side, key, value))
      return
    }

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
        {linkedEyes ? fields.map((field) => {
          const range = isExpressionGeometryKey(field.key)
            ? sharedExpressionGeometryRange(model, field.key)
            : { min: field.min, max: field.max }
          return (
            <NumericControl
              key={field.key}
              label={field.label}
              value={sharedValue(model.expression, field.key)}
              min={range.min}
              max={range.max}
              step={field.step}
              onChange={(value) => updateShared(field.key, value)}
            />
          )
        }) : (
          <div className="eye-columns">
            {(['left', 'right'] as const).map((side) => {
              const expression = resolveEyeExpression(model.expression, side)
              return (
                <fieldset className="eye-fieldset" key={side}>
                  <legend>{side === 'left' ? 'Left eye expression' : 'Right eye expression'}</legend>
                  {fields.map((field) => {
                    const range = isExpressionGeometryKey(field.key)
                      ? independentExpressionGeometryRange(model, side, field.key)
                      : { min: field.min, max: field.max }
                    return (
                      <NumericControl
                        key={field.key}
                        label={field.label}
                        value={expression[field.key]}
                        min={range.min}
                        max={range.max}
                        step={field.step}
                        onChange={(value) => updateSide(side, field.key, value)}
                      />
                    )
                  })}
                </fieldset>
              )
            })}
          </div>
        )}
      </div>
    </details>
  )
}
