import { useEffect, useState } from 'react'
import { renderFaceToSvg } from '../../renderers/svg'
import {
  phase2ExpressionVisualFixtures,
  type Phase2ExpressionVisualFixture,
} from '../../renderers/svg/__fixtures__/phase2Expressions'
import {
  GALLERY_MOTION_PREVIEW_CYCLE_MS,
  isInteractiveGalleryFixture,
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
  if (fixture.id === 'curious-center-128x64') return 'Curious · Center'
  if (fixture.id === 'curious-right-128x64') return 'Curious · Right'
  if (fixture.id === 'happy-240x240') return 'Happy · Square'
  return fixture.presetName ?? fixture.id
}

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

  return (
    <details className="panel visual-regression-gallery">
      <summary className="visual-regression-summary">
        <span>
          <span className="eyebrow">Quality</span>
          <strong>Visual Regression Gallery</strong>
        </span>
        <span className="visual-regression-count">
          {phase2ExpressionVisualFixtures.length} fixtures
        </span>
      </summary>

      <div className="visual-regression-intro">
        <p>
          The upper image on every card is the fixed regression fixture used for the status check.
          Apply changes the editor through normal history; Motion preview is a separate opt-in Phase 3
          transition and never changes the fixture comparison.
        </p>
      </div>

      <div className="visual-regression-grid">
        {phase2ExpressionVisualFixtures.map((fixture) => {
          const model = modelForFixture(fixture)
          const svg = renderFaceToSvg(model, { idPrefix: `visual-regression-${fixture.id}` })
          const matches = matchesFixture(svg, fixture)
          const interactive = isInteractiveGalleryFixture(fixture)
          const selection = selectionForFixture(fixture)
          const isSelected = interactive
            && selection.presetId !== 'custom'
            && selection.presetId === activeExpressionId
          const isMotionActive = interactive && motionFixtureId === fixture.id
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
                <div>
                  <h3>{fixtureTitle(fixture)}</h3>
                  <p>{fixture.id}</p>
                </div>
                <span className={`fixture-status ${matches ? 'fixture-status-match' : 'fixture-status-changed'}`}>
                  {matches ? 'Matches fixture' : 'Changed'}
                </span>
              </div>

              <div
                className="visual-regression-card-preview"
                style={{ aspectRatio: `${fixture.canvas.width} / ${fixture.canvas.height}` }}
                role="img"
                aria-label={`${fixtureTitle(fixture)} fixed visual regression fixture`}
                dangerouslySetInnerHTML={{ __html: svg }}
              />

              <dl className="visual-regression-meta">
                <div>
                  <dt>Canvas</dt>
                  <dd>{fixture.canvas.width} × {fixture.canvas.height}</dd>
                </div>
                <div>
                  <dt>Gaze</dt>
                  <dd>{fixture.gaze.x}, {fixture.gaze.y}</dd>
                </div>
              </dl>

              {interactive && (
                <div className="visual-regression-actions" aria-label={`${fixtureTitle(fixture)} actions`}>
                  <button
                    type="button"
                    onClick={() => onApplySelection(selection)}
                    disabled={disabled}
                  >
                    Apply expression
                  </button>
                  {isCuriousFixture && (
                    <button
                      type="button"
                      onClick={() => onApplySelection(selectionForFixture(fixture, true))}
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
                    {isMotionActive ? 'Stop motion' : 'Preview motion'}
                  </button>
                </div>
              )}

              {motionSvg !== undefined && (
                <div className="visual-regression-motion-block">
                  <div className="visual-regression-motion-label">
                    <span>Motion preview</span>
                    <span>Phase 3 · runtime only</span>
                  </div>
                  <div
                    className="visual-regression-card-preview visual-regression-motion-preview"
                    style={{ aspectRatio: `${fixture.canvas.width} / ${fixture.canvas.height}` }}
                    role="img"
                    aria-label={`${fixtureTitle(fixture)} motion preview`}
                    dangerouslySetInnerHTML={{ __html: motionSvg }}
                  />
                </div>
              )}
            </article>
          )
        })}
      </div>
    </details>
  )
}
