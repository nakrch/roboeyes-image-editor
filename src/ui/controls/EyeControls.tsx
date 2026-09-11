import { useMemo } from 'react'
import type { FaceModel } from '../../core/model'
import {
  independentEyeDimensionRanges,
  linkedEyeDimensionRanges,
  setIndependentEyeDimensionSafely,
  setLinkedEyeDimensionSafely,
} from '../editor/eyeDimensions'
import {
  independentEyePositionRange,
  rigidEyePositionRange,
  setIndependentEyePositionSafely,
} from '../editor/eyePositionSafety'
import {
  independentEyeRotationRange,
  setIndependentEyeRotationSafely,
} from '../editor/eyeRotationSafety'
import {
  anchoredPairSpacing,
  anchoredPairSpacingMin,
} from '../editor/geometrySafety'
import {
  centerRelativePositionRange,
  fromCenterRelativePosition,
  toCenterRelativePosition,
} from '../editor/centerRelativePosition'
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
import {
  isSingleEyeLayout,
  moveSingleEye,
  preserveSingleEyeSpacing,
} from '../editor/singleEyeLayout'
import { NumericControl } from './NumericControl'

type EyeControlsProps = {
  model: FaceModel
  linkedEyes: boolean
  onChange: (updater: (current: FaceModel) => FaceModel) => void
  onLinkedEyesChange: (value: boolean) => void
  onSingleEyeLayoutChange: (enabled: boolean) => void
}

export function EyeControls({
  model,
  linkedEyes,
  onChange,
  onLinkedEyesChange,
  onSingleEyeLayoutChange,
}: EyeControlsProps) {
  const left = model.leftEye.geometry
  const right = model.rightEye.geometry
  const singleEye = isSingleEyeLayout(model)

  // These helpers intentionally perform exhaustive canvas-safety scans. During
  // animation playback the parent editor re-renders at preview cadence, but the
  // authored model object normally stays unchanged. Cache the expensive scans by
  // authored model identity so playback frames do not recompute them at 60 fps.
  const linkedDerived = useMemo(() => {
    const xAbsolutePositionRange = rigidEyePositionRange(model, 'x', pairCenterX(model))
    const yAbsolutePositionRange = rigidEyePositionRange(model, 'y', pairCenterY(model))
    return {
      rotationLimits: pairRotationLimits(model),
      dimensionRanges: linkedEyeDimensionRanges(model),
      positionRanges: {
        x: centerRelativePositionRange(
          model,
          'x',
          xAbsolutePositionRange.min,
          xAbsolutePositionRange.max,
        ),
        y: centerRelativePositionRange(
          model,
          'y',
          yAbsolutePositionRange.min,
          yAbsolutePositionRange.max,
        ),
      },
    }
  }, [model])

  const independentDerived = useMemo(() => {
    if (linkedEyes && !singleEye) return undefined

    const deriveSide = (side: EyeSide) => {
      const geometry = side === 'left' ? model.leftEye.geometry : model.rightEye.geometry
      const xAbsolutePositionRange = singleEye && side === 'left'
        ? rigidEyePositionRange(model, 'x', geometry.position.x)
        : independentEyePositionRange(model, side, 'x')
      const yAbsolutePositionRange = singleEye && side === 'left'
        ? rigidEyePositionRange(model, 'y', geometry.position.y)
        : independentEyePositionRange(model, side, 'y')

      return {
        dimensionRanges: independentEyeDimensionRanges(model, side),
        rotationRange: independentEyeRotationRange(model, side),
        positionRanges: {
          x: centerRelativePositionRange(
            model,
            'x',
            xAbsolutePositionRange.min,
            xAbsolutePositionRange.max,
          ),
          y: centerRelativePositionRange(
            model,
            'y',
            yAbsolutePositionRange.min,
            yAbsolutePositionRange.max,
          ),
        },
      }
    }

    return {
      left: deriveSide('left'),
      right: deriveSide('right'),
    }
  }, [linkedEyes, model, singleEye])

  const spacingDerived = useMemo(() => ({
    spacing: anchoredPairSpacing(model),
    min: anchoredPairSpacingMin(model),
    max: canvasSafeAnchoredPairSpacingMax(model),
  }), [model])

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
        const next = setIndependentEyeDimensionSafely(current, side, key, value)
        return singleEye && side === 'left' && key === 'width'
          ? preserveSingleEyeSpacing(current, next)
          : next
      }
      if (key === 'rotation') {
        return setIndependentEyeRotationSafely(current, side, value)
      }

      return updateEyeGeometry(current, side, (geometry) => ({ ...geometry, [key]: value }))
    })
  }

  const updateEyePosition = (side: EyeSide, axis: 'x' | 'y', value: number) => {
    onChange((current) => {
      const absoluteValue = fromCenterRelativePosition(current, axis, value)
      if (singleEye && side === 'left') {
        return moveSingleEye(
          current,
          axis === 'x' ? absoluteValue : undefined,
          axis === 'y' ? absoluteValue : undefined,
        )
      }
      return setIndependentEyePositionSafely(current, side, axis, absoluteValue)
    })
  }

  const singleDerived = independentDerived?.left

  return (
    <>
      <details className="control-group collapsible-control-group" open>
        <summary className="control-group-summary">
          <span className="eyes-geometry-title">Eyes</span>
          {!singleEye && (
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
          )}
        </summary>

        <div className="nested-controls control-group-body">
          <div className="control-row">
            <span className="control-label">Layout</span>
            <span className="segmented-control" aria-label="Eye layout">
              <button
                type="button"
                className={!singleEye ? 'active' : ''}
                aria-pressed={!singleEye}
                onClick={() => onSingleEyeLayoutChange(false)}
              >
                Two eyes
              </button>
              <button
                type="button"
                className={singleEye ? 'active' : ''}
                aria-pressed={singleEye}
                onClick={() => onSingleEyeLayoutChange(true)}
              >
                Single eye
              </button>
            </span>
          </div>

          {singleEye ? (
            <div className="nested-controls">
              <p className="animation-note">
                Single-eye mode edits the visible primary eye. The hidden eye is retained so switching back to two eyes restores the paired layout around the current center.
              </p>
              <NumericControl label="Eye width" value={left.width} min={singleDerived!.dimensionRanges.width.min} max={singleDerived!.dimensionRanges.width.max} step="any" onChange={(value) => updateIndependentGeometry('left', 'width', value)} />
              <NumericControl label="Eye height" value={left.height} min={singleDerived!.dimensionRanges.height.min} max={singleDerived!.dimensionRanges.height.max} step="any" onChange={(value) => updateIndependentGeometry('left', 'height', value)} />
              <NumericControl label="Corner radius" value={left.cornerRadius} min={0} max={80} onChange={(value) => updateIndependentGeometry('left', 'cornerRadius', value)} />
              <NumericControl label="Rotation" value={left.rotation} min={singleDerived!.rotationRange.min} max={singleDerived!.rotationRange.max} step="any" onChange={(value) => updateIndependentGeometry('left', 'rotation', value)} />
            </div>
          ) : linkedEyes ? (
            <div className="nested-controls">
              <NumericControl label="Eye width" value={(left.width + right.width) / 2} min={linkedDerived.dimensionRanges.width.min} max={linkedDerived.dimensionRanges.width.max} step="any" onChange={(value) => updateLinkedGeometry('width', value)} />
              <NumericControl label="Eye height" value={(left.height + right.height) / 2} min={linkedDerived.dimensionRanges.height.min} max={linkedDerived.dimensionRanges.height.max} step="any" onChange={(value) => updateLinkedGeometry('height', value)} />
              <NumericControl label="Corner radius" value={(left.cornerRadius + right.cornerRadius) / 2} min={0} max={80} onChange={(value) => updateLinkedGeometry('cornerRadius', value)} />
              <NumericControl label="Rotation" value={pairRotation(model)} min={linkedDerived.rotationLimits.min} max={linkedDerived.rotationLimits.max} step="any" onChange={(value) => onChange((current) => rotatePairSafely(current, value))} />
            </div>
          ) : (
            <div className="eye-columns">
              {(['left', 'right'] as const).map((side) => {
                const geometry = side === 'left' ? left : right
                const derived = independentDerived![side]
                return (
                  <fieldset className="eye-fieldset" key={side}>
                    <legend>{side === 'left' ? 'Left eye' : 'Right eye'}</legend>
                    <NumericControl label="Width" value={geometry.width} min={derived.dimensionRanges.width.min} max={derived.dimensionRanges.width.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'width', value)} />
                    <NumericControl label="Height" value={geometry.height} min={derived.dimensionRanges.height.min} max={derived.dimensionRanges.height.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'height', value)} />
                    <NumericControl label="Corner radius" value={geometry.cornerRadius} min={0} max={80} onChange={(value) => updateIndependentGeometry(side, 'cornerRadius', value)} />
                    <NumericControl label="Rotation" value={geometry.rotation} min={derived.rotationRange.min} max={derived.rotationRange.max} step="any" onChange={(value) => updateIndependentGeometry(side, 'rotation', value)} />
                  </fieldset>
                )
              })}
            </div>
          )}

          {!singleEye && (
            <NumericControl
              label="Eye spacing"
              value={spacingDerived.spacing}
              min={spacingDerived.min}
              max={spacingDerived.max}
              step="any"
              onChange={(value) => onChange((current) => setCanvasSafeAnchoredPairSpacing(current, value))}
            />
          )}
        </div>
      </details>

      <details className="control-group collapsible-control-group" open>
        <summary className="control-group-summary">Position</summary>
        <div className="nested-controls control-group-body">
          {singleEye ? (
            <>
              <NumericControl label="Position X" value={toCenterRelativePosition(model, 'x', left.position.x)} min={singleDerived!.positionRanges.x.min} max={singleDerived!.positionRanges.x.max} step="any" onChange={(value) => updateEyePosition('left', 'x', value)} />
              <NumericControl label="Position Y" value={toCenterRelativePosition(model, 'y', left.position.y)} min={singleDerived!.positionRanges.y.min} max={singleDerived!.positionRanges.y.max} step="any" onChange={(value) => updateEyePosition('left', 'y', value)} />
            </>
          ) : linkedEyes ? (
            <>
              <NumericControl
                label="Position X"
                value={toCenterRelativePosition(model, 'x', pairCenterX(model))}
                min={linkedDerived.positionRanges.x.min}
                max={linkedDerived.positionRanges.x.max}
                step="any"
                onChange={(value) => onChange((current) => movePair(
                  current,
                  fromCenterRelativePosition(current, 'x', value),
                  undefined,
                ))}
              />
              <NumericControl
                label="Position Y"
                value={toCenterRelativePosition(model, 'y', pairCenterY(model))}
                min={linkedDerived.positionRanges.y.min}
                max={linkedDerived.positionRanges.y.max}
                step="any"
                onChange={(value) => onChange((current) => movePair(
                  current,
                  undefined,
                  fromCenterRelativePosition(current, 'y', value),
                ))}
              />
            </>
          ) : (
            <div className="eye-columns position-eye-columns">
              {(['left', 'right'] as const).map((side) => {
                const geometry = side === 'left' ? left : right
                const derived = independentDerived![side]
                return (
                  <fieldset className="eye-fieldset" key={side}>
                    <legend>{side === 'left' ? 'Left eye' : 'Right eye'}</legend>
                    <NumericControl label="X" value={toCenterRelativePosition(model, 'x', geometry.position.x)} min={derived.positionRanges.x.min} max={derived.positionRanges.x.max} step="any" onChange={(value) => updateEyePosition(side, 'x', value)} />
                    <NumericControl label="Y" value={toCenterRelativePosition(model, 'y', geometry.position.y)} min={derived.positionRanges.y.min} max={derived.positionRanges.y.max} step="any" onChange={(value) => updateEyePosition(side, 'y', value)} />
                  </fieldset>
                )
              })}
            </div>
          )}
        </div>
      </details>
    </>
  )
}
