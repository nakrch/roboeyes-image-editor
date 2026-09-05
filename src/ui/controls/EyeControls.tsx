import type { FaceModel } from '../../core/model'
import {
  independentEyeDimensionLimits,
  linkedEyeDimensionLimits,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from '../editor/eyeDimensions'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMax,
  setAnchoredPairSpacingSafely,
} from '../editor/geometrySafety'
import {
  movePair,
  pairCenterX,
  pairCenterY,
  pairRotation,
  pairRotationLimits,
  rotatePairSafely,
  updateEyeGeometry,
  type EyeSide,
  type GeometryKey,
} from '../editor/modelEditing'
import { NumericControl } from './NumericControl'

type EyeControlsProps = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
}

export function EyeControls({
  model,
  linkedEyes,
  onChange,
  onLinkedEyesChange,
}: EyeControlsProps) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const linkedRotationLimits = pairRotationLimits(model)
  const linkedDimensionLimits = linkedEyeDimensionLimits(model)
  const spacing = anchoredPairSpacing(model)
  const spacingMax = anchoredPairSpacingMax(model)

  const updateLinkedGeometry = (key: GeometryKey, value: number) => {
    onChange((current) => {
      if (key === 'width' || key === 'height') {
        return setLinkedEyeDimensionSafely(current, key, value)
      }

      return {
        ...current,
        leftEye: {
          ...current.leftEye,
          geometry: { ...current.leftEye.geometry, [key]: value },
        },
        rightEye: {
          ...current.rightEye,
          geometry: { ...current.rightEye.geometry, [key]: value },
        },
      }
    })
  }

  const updateIndependentGeometry = (side: EyeSide, key: GeometryKey, value: number) => {
    onChange((current) => {
      if (key === 'width' || key === 'height') {
        return setIndependentEyeDimensionSafely(current, side, key, value)
      }

      return updateEyeGeometry(current, side, (geometry) => ({ ...geometry, [key]: value }))
    })
  }

  const updateEyePosition = (side: EyeSide, axis: 'x' | 'y', value: number) => {
    onChange((current) =>
      updateEyeGeometry(current, side, (geometry) => ({
        ...geometry,
        position: { ...geometry.position, [axis]: value },
      })),
    )
  }

  return (
    <details className="control-group collapsible-control-group" open>
      <summary className="control-group-summary">
        <span>Eyes</span>
        <span className="segmented-control" aria-label="Eye editing mode" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={linkedEyes ? 'active' : ''}
            aria-pressed={linkedEyes}
            onClick={() => onLinkedEyesChange(true)}
          >
            Linked
          </button>
          <button
            type="button"
            className={!linkedEyes ? 'active' : ''}
            aria-pressed={!linkedEyes}
            onClick={() => onLinkedEyesChange(false)}
          >
            Independent
          </button>
        </span>
      </summary>

      <div className="nested-controls control-group-body">
        {linkedEyes ? (
          <div className="nested-controls">
            <NumericControl label="Eye width" value={(left.width + right.width) / 2} min={1} max={linkedDimensionLimits.width} step="any" onChange={(value) => updateLinkedGeometry('width', value)} />
            <NumericControl label="Eye height" value={(left.height + right.height) / 2} min={1} max={linkedDimensionLimits.height} step="any" onChange={(value) => updateLinkedGeometry('height', value)} />
            <NumericControl label="Corner radius" value={(left.cornerRadius + right.cornerRadius) / 2} min={0} max={80} onChange={(value) => updateLinkedGeometry('cornerRadius', value)} />
            <NumericControl label="Position X" value={pairCenterX(model)} min={-320} max={640} onChange={(value) => onChange((current) => movePair(current, value, undefined))} />
            <NumericControl label="Position Y" value={pairCenterY(model)} min={-320} max={640} onChange={(value) => onChange((current) => movePair(current, undefined, value))} />
            <NumericControl
              label="Rotation"
              value={pairRotation(model)}
              min={linkedRotationLimits.min}
              max={linkedRotationLimits.max}
              step="any"
              onChange={(value) => onChange((current) => rotatePairSafely(current, value))}
            />
          </div>
        ) : (
          <div className="eye-columns">
            {(['left', 'right'] as const).map((side) => {
              const geometry = side === 'left' ? left : right
              const dimensionLimits = independentEyeDimensionLimits(model, side)
              return (
                <fieldset className="eye-fieldset" key={side}>
                  <legend>{side === 'left' ? 'Left eye' : 'Right eye'}</legend>
                  <NumericControl label="Width" value={geometry.width} min={1} max={dimensionLimits.width} step="any" onChange={(value) => updateIndependentGeometry(side, 'width', value)} />
                  <NumericControl label="Height" value={geometry.height} min={1} max={dimensionLimits.height} step="any" onChange={(value) => updateIndependentGeometry(side, 'height', value)} />
                  <NumericControl label="Corner radius" value={geometry.cornerRadius} min={0} max={80} onChange={(value) => updateIndependentGeometry(side, 'cornerRadius', value)} />
                  <NumericControl label="Position X" value={geometry.position.x} min={-320} max={640} onChange={(value) => updateEyePosition(side, 'x', value)} />
                  <NumericControl label="Position Y" value={geometry.position.y} min={-320} max={640} onChange={(value) => updateEyePosition(side, 'y', value)} />
                  <NumericControl label="Rotation" value={geometry.rotation} min={-45} max={45} onChange={(value) => updateIndependentGeometry(side, 'rotation', value)} />
                </fieldset>
              )
            })}
          </div>
        )}

        <NumericControl
          label="Eye spacing"
          value={spacing}
          min={0}
          max={spacingMax}
          step="any"
          onChange={(value) => onChange((current) => setAnchoredPairSpacingSafely(current, value))}
        />
      </div>
    </details>
  )
}
