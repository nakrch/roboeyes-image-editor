import type { FaceModel } from '../../core/model'
import {
  independentEyeDimensionRanges,
  linkedEyeDimensionRanges,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from '../editor/eyeDimensions'
import { setIndependentEyePositionSafely } from '../editor/eyePositionSafety'
import {
  independentEyeRotationRange,
  setIndependentEyeRotationSafely,
} from '../editor/eyeRotationSafety'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMin,
} from '../editor/geometrySafety'
import {
  canvasSafeAnchoredPairSpacingMax,
  setCanvasSafeAnchoredPairSpacing,
} from '../editor/spacingCanvasSafety'
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
  const linkedDimensionRanges = linkedEyeDimensionRanges(model)
  const spacing = anchoredPairSpacing(model)
  const spacingMin = anchoredPairSpacingMin(model)
  const spacingMax = canvasSafeAnchoredPairSpacingMax(model)

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
      if (key === 'rotation') {
        return setIndependentEyeRotationSafely(current, side, value)
      }

      return updateEyeGeometry(current, side, (geometry) => ({ ...geometry, [key]: value }))
    })
  }

  const updateEyePosition = (side: EyeSide, axis: 'x' | 'y', value: number) => {
    onChange((current) => setIndependentEyePositionSafely(current, side, axis, value))
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
            <NumericControl label="Eye width" value={(left.width + right.width) / 2} min={linkedDimensionRanges.width.min} max={linkedDimensionRanges.width.max} step="any" onChange={(value) => updateLinkedGeometry('width', value)} />
            <NumericControl label="Eye height" value={(left.height + right.height) / 2} min={linkedDimensionRanges.height.min} max={linkedDimensionRanges.height.max} step="any" onChange={(value) => updateLinkedGeometry('height', value)} />
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
              const dimensionRanges = independentEyeDimensionRanges(model, side)
              const rotationRange = independentEyeRotationRange(model, side)
              return (
                <fieldset className="eye-fieldset" key={side}>
                  <legend>{side === 'left' ? 'Left eye' : 'Right eye'}</legend>
                  <NumericControl label="Width" value={geometry.width} min={dimensionRanges.width.min} max={dimensionRanges.width.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'width', value)} />
                  <NumericControl label="Height" value={geometry.height} min={dimensionRanges.height.min} max={dimensionRanges.height.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'height', value)} />
                  <NumericControl label="Corner radius" value={geometry.cornerRadius} min={0} max={80} onChange={(value) => updateIndependentGeometry(side, 'cornerRadius', value)} />
                  <NumericControl label="Position X" value={geometry.position.x} min={-320} max={640} onChange={(value) => updateEyePosition(side, 'x', value)} />
                  <NumericControl label="Position Y" value={geometry.position.y} min={-320} max={640} onChange={(value) => updateEyePosition(side, 'y', value)} />
                  <NumericControl label="Rotation" value={geometry.rotation} min={rotationRange.min} max={rotationRange.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'rotation', value)} />
                </fieldset>
              )
            })}
          </div>
        )}

        <NumericControl
          label="Eye spacing"
          value={spacing}
          min={spacingMin}
          max={spacingMax}
          step="any"
          onChange={(value) => onChange((current) => setCanvasSafeAnchoredPairSpacing(current, value))}
        />
      </div>
    </details>
  )
}
