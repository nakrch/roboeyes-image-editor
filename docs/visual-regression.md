# Phase 2 expression visual regression

Phase 2 expression geometry is protected by textual SVG-signature fixtures in:

- `src/renderers/svg/__fixtures__/phase2Expressions.ts`
- `src/renderers/svg/phase2VisualRegression.test.ts`

The browser also surfaces a review-oriented subset through `Visual Regression Gallery` at the bottom of the editor. The gallery is collapsed by default so it does not interfere with normal editing.

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

## Browser gallery

Each visible gallery card renders the current SVG from the normal renderer and compares its aperture paths and eye transforms with the stored fixture signature.

- **Matches fixture** means the live renderer output still matches the committed reference.
- **Changed** means the current visible geometry differs from the reference and should be reviewed before the fixture is updated.

Cards also show the fixture id, canvas size, and gaze coordinates. This makes the deterministic CI checks reviewable visually without replacing them with screenshots.

Some fixtures remain in the regression suite but are deliberately omitted from the browser gallery because they are redundant for interactive browsing:

- `neutral-128x64`
- `curious-center-128x64`
- `happy-240x240`

They continue to protect deterministic renderer behavior in CI; hiding them affects only the browser gallery.

### Expression selection

Issue #96 also makes the visible gallery cards an optional expression browser without changing their regression role.

- **Apply expression** copies only the fixture expression into the authored editor model through the normal history path.
- Built-in expression identity is preserved so the Expression Presets selector follows the applied card.
- The asymmetric fixture applies as `Custom`; it is not automatically saved as a user expression preset.
- Curious left/right cards keep gaze explicit: **Apply expression** preserves the authored gaze, while **Apply + gaze** deliberately applies both Curious and that fixture's gaze.

The main editor preview uses a short deterministic Phase 3 state transition when a gallery selection is applied. Only the final authored expression/gaze is committed as one history entry. The interpolated frames are transient preview state and never produce frame-by-frame Undo/Redo entries.

### Motion preview boundary

Each visible card can start an explicit **Preview motion** loop. This is intentionally separate from the regression fixture shown above it:

```text
fixed fixture model -> renderer -> Matches fixture / Changed

fixed fixture model -> Phase 3 sampler(time) -> separate Motion preview
```

The motion preview uses `createFaceTransition()` / `sampleFaceTransition()` with explicit logical time. It does not add timers, randomness, or expression names to `renderFaceToSvg()`, and it never feeds animated output into fixture matching. Expanding the gallery alone starts no motion; playback is opt-in per card.

This separation is important because the gallery now serves two purposes without conflating them:

1. deterministic regression review of the visible fixture subset;
2. user-facing visual browsing and temporary animation inspection.

The full regression suite remains CI-owned even when a fixture is omitted from the browser gallery.

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
5. Expand the Visual Regression Gallery and inspect every affected visible card in the PR Preview.
6. Confirm `Matches fixture` / `Changed` still reflects only the fixed card render, not Motion preview output.
7. Validate expression apply, Curious explicit gaze behavior, and Motion preview in the PR Preview when those controls change.
8. Validate the PR Preview before merge when the resulting output is user-visible.

When a new built-in expression preset is added, the coverage assertion intentionally fails until at least one visual fixture is added for it.
