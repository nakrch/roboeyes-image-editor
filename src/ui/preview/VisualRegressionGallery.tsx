import { useEffect, useState } from 'react'
import { renderFaceToSvg } from '../../renderers/svg'
import {
  phase2ExpressionVisualFixtures,
  type Phase2ExpressionVisualFixture,
} from '../../renderers/svg/__fixtures__/phase2Expressions'
import { useToast } from '../feedback/ToastProvider'
import {
  GALLERY_MOTION_PREVIEW_CYCLE_MS,
  isGalleryVisibleFixture,
  modelForFixture,
  sampleFixtureMotionPreview,
  selectionForFixture,
  type GalleryExpressionSelection,
} from './visualRegressionGalleryModel'
import './visualRegressionGallery.css'

function aperturePath(svg: string, side: 'left' | 'right'): string | undefined {
  return svg.match(new RegExp(`data-eye-aperture="${side}" d="([^"]+)"`))?.[1]
}

function eyeTransform(svg: string, side: 'left' | 'right'): string | undefined {
  return svg.match(new RegExp(`data-eye="${side}"[^>]* transform="([^"]+)"`))?.[1]
}

function matchesFixture(svg: string, fixture: Phase2ExpressionVisualFixture): boolean {
  return aperturePath(svg, 'left') === fixture.expected.leftPath
    && aperturePath(svg, 'right') === fixture.expected.rightPath
    && eyeTransform(svg, 'left') === fixture.expected.leftTransform
    && eyeTransform(svg, 'right') === fixture.expected.rightTransform
}

function fixtureTitle(fixture: Phase2ExpressionVisualFixture): string {
  if (fixture.id === 'asymmetric-custom-128x64') return 'Asymmetric custom'
  if (fixture.id === 'curious-left-128x64') return 'Curious · Left'
  if (fixture.id === 'curious-right-128x64') return 'Curious · Right'
  return fixture.presetName ?? fixture.id
}

const galleryFixtures = phase2ExpressionVisualFixtures.filter(isGalleryVisibleFixture)

type VisualRegressionGalleryProps = {
  activeExpressionId: string
  disabled?: boolean
  onApplySelection: (selection: GalleryExpressionSelection) => void
}

export function VisualRegressionGallery({
  activeExpressionId,
  disabled = false,
  onApplySelection,
}: VisualRegressionGalleryProps) {
  const [motionFixtureId, setMotionFixtureId] = useState<string | null>(null)
  const [motionTimeMs, setMotionTimeMs] = useState(0)
  const { notify } = useToast()

  useEffect(() => {
    if (motionFixtureId === null) {
      setMotionTimeMs(0)
      return
    }

    let animationFrame = 0
    const startTime = performance.now()
    const tick = (now: number) => {
      setMotionTimeMs((now - startTime) % GALLERY_MOTION_PREVIEW_CYCLE_MS)
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [motionFixtureId])

  const applySelection = (selection: GalleryExpressionSelection, title: string) => {
    try {
      onApplySelection(selection)
      notify('success', `Applied ${title}.`)
    } catch {
      notify('error', `Could not apply ${title}.`)
    }
  }

  return (
    <details className="visual-regression-gallery">
      <summary className="visual-regression-summary">
        <span className="visual-regression-summary-copy">
          <span className="visual-regression-kicker">Diagnostics</span>
          <strong>Visual Regression Gallery</strong>
        </span>
        <span className="visual-regression-count">
          {galleryFixtures.length} fixtures
        </span>
      </summary>

      <div className="visual-regression-body">
        <p className="visual-regression-intro">
          Fixed regression fixtures for expression geometry. Apply uses normal editor history; Motion preview is runtime-only and never changes the fixture comparison.
        </p>

        <div className="visual-regression-grid">
          {galleryFixtures.map((fixture) => {
            const model = modelForFixture(fixture)
            const svg = renderFaceToSvg(model, { idPrefix: `visual-regression-${fixture.id}` })
            const matches = matchesFixture(svg, fixture)
            const selection = selectionForFixture(fixture)
            const title = fixtureTitle(fixture)
            const isSelected = selection.presetId !== 'custom' && selection.presetId === activeExpressionId
            const isMotionActive = motionFixtureId === fixture.id
            const motionSvg = isMotionActive
              ? renderFaceToSvg(sampleFixtureMotionPreview(fixture, motionTimeMs), {
                  idPrefix: `visual-regression-motion-${fixture.id}`,
                })
              : undefined
            const isCuriousFixture = fixture.presetName === 'Curious'

            return (
              <article
                className={`visual-regression-card${isSelected ? ' visual-regression-card-selected' : ''}`}
                key={fixture.id}
              >
                <div className="visual-regression-card-header">
                  <div className="visual-regression-card-title">
                    <h3>{title}</h3>
                    <p>{fixture.id}</p>
                  </div>
                  <span
                    className="fixture-status"
                    data-state={matches ? 'match' : 'changed'}
                  >
                    {matches ? 'Matches' : 'Changed'}
                  </span>
                </div>

                <div
                  className="visual-regression-card-preview"
                  style={{ aspectRatio: `${fixture.canvas.width} / ${fixture.canvas.height}` }}
                  role="img"
                  aria-label={`${title} fixed visual regression fixture`}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />

                <div className="visual-regression-meta" aria-label={`${title} fixture metadata`}>
                  <span>{fixture.canvas.width} × {fixture.canvas.height}</span>
                  <span>Gaze {fixture.gaze.x}, {fixture.gaze.y}</span>
                </div>

                <div className="visual-regression-actions" aria-label={`${title} actions`}>
                  <button
                    type="button"
                    onClick={() => applySelection(selection, title)}
                    disabled={disabled}
                  >
                    Apply
                  </button>
                  {isCuriousFixture && (
                    <button
                      type="button"
                      onClick={() => applySelection(selectionForFixture(fixture, true), `${title} + gaze`)}
                      disabled={disabled}
                      title="Apply Curious and this fixture's gaze explicitly"
                    >
                      Apply + gaze
                    </button>
                  )}
                  <button
                    type="button"
                    className={isMotionActive ? 'active' : undefined}
                    aria-pressed={isMotionActive}
                    onClick={() => setMotionFixtureId((current) => current === fixture.id ? null : fixture.id)}
                  >
                    {isMotionActive ? 'Stop motion' : 'Motion'}
                  </button>
                </div>

                {motionSvg !== undefined && (
                  <div className="visual-regression-motion-block">
                    <div className="visual-regression-motion-label">
                      <span>Runtime motion</span>
                      <span>Preview only</span>
                    </div>
                    <div
                      className="visual-regression-card-preview visual-regression-motion-preview"
                      style={{ aspectRatio: `${fixture.canvas.width} / ${fixture.canvas.height}` }}
                      role="img"
                      aria-label={`${title} motion preview`}
                      dangerouslySetInnerHTML={{ __html: motionSvg }}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </details>
  )
}
