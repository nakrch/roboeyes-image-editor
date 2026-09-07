import { roboEyesToFaceModel } from '../../core/adapters/roboeyes'
import type { ExpressionModel, FaceModel } from '../../core/model'
import { defaultRoboEyesPreset, expressionPresets } from '../../core/presets'
import { renderFaceToSvg } from '../../renderers/svg'
import {
  phase2ExpressionVisualFixtures,
  type Phase2ExpressionVisualFixture,
} from '../../renderers/svg/__fixtures__/phase2Expressions'

function expressionForFixture(fixture: Phase2ExpressionVisualFixture): ExpressionModel {
  if (fixture.expression) return structuredClone(fixture.expression)
  const preset = expressionPresets.find((candidate) => candidate.name === fixture.presetName)
  if (!preset) throw new Error(`Missing expression preset for fixture ${fixture.id}`)
  return structuredClone(preset.expression)
}

function modelForFixture(fixture: Phase2ExpressionVisualFixture): FaceModel {
  const base = roboEyesToFaceModel({
    ...defaultRoboEyesPreset,
    canvasWidth: fixture.canvas.width,
    canvasHeight: fixture.canvas.height,
    gazeX: fixture.gaze.x,
    gazeY: fixture.gaze.y,
  })
  return {
    ...base,
    expression: expressionForFixture(fixture),
  }
}

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

export function VisualRegressionGallery() {
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
          Live renderer output for the Phase 2 reference fixtures. A changed geometry signature is
          flagged directly on the card in addition to the CI regression test.
        </p>
      </div>

      <div className="visual-regression-grid">
        {phase2ExpressionVisualFixtures.map((fixture) => {
          const model = modelForFixture(fixture)
          const svg = renderFaceToSvg(model, { idPrefix: `visual-regression-${fixture.id}` })
          const matches = matchesFixture(svg, fixture)

          return (
            <article className="visual-regression-card" key={fixture.id}>
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
                aria-label={`${fixtureTitle(fixture)} visual regression fixture`}
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
            </article>
          )
        })}
      </div>
    </details>
  )
}
