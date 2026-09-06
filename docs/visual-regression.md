# Phase 2 expression visual regression

Phase 2 expression geometry is protected by textual SVG-signature fixtures in:

- `src/renderers/svg/__fixtures__/phase2Expressions.ts`
- `src/renderers/svg/phase2VisualRegression.test.ts`

The fixtures intentionally store the visible **aperture path** and **eye transform** rather than raster screenshots. This keeps changes deterministic and makes geometry diffs reviewable in Git while still detecting changes to:

- upper-lid direction and mirroring
- rounded lower cuts
- expression tilt
- per-eye/asymmetric overrides
- gaze-reactive Curious height
- canvas-relative placement

## Coverage

The fixture suite covers every built-in Phase 2 expression preset at the 128×64 RoboEyes reference size:

- Neutral
- Happy
- Tired
- Angry
- Curious
- Surprised
- Sad
- Suspicious
- Serious
- Irritated

Curious has separate left, center, and right gaze fixtures. An independent asymmetric custom expression is included, plus a 240×240 Happy fixture to protect non-128×64 behavior.

The suite also checks that the SVG used by preview rendering and the SVG export path are identical for the same model and default export dimensions.

## Reference orientation

For the RoboEyes-compatible directional lids, the assertions preserve the FluxGarage/RoboEyes mask orientation:

- **Tired**: physical outer corners are covered more deeply.
- **Angry**: physical inner corners are covered more deeply.
- **Happy**: the lower aperture uses a raised rounded/curved center cut.

## Updating fixtures

A fixture change should be treated as a visible renderer/expression change, not a routine snapshot refresh.

1. Confirm the change is intentional against the relevant source/reference implementation.
2. Update the expression/model implementation first.
3. Inspect the changed textual paths/transforms.
4. Run the full test/build suite.
5. Validate the PR Preview before merge when the resulting output is user-visible.

When a new built-in expression preset is added, the coverage assertion intentionally fails until at least one visual fixture is added for it.
