# AGENTS.md

## Project intent

`roboeyes-image-editor` is a **small-display oriented Parametric Robot Face Editor**. It generalizes the design philosophy of RoboEyes rather than implementing a browser-only clone.

Read these before making architectural changes:

1. `docs/direction.md`
2. `docs/architecture.md`
3. `docs/roadmap.md`
4. `docs/README.md`
5. the active GitHub Issue

Phase 1–3 are complete. Treat the current static model, expression system, deterministic animation runtime, browser authoring/player workflow, and static/animated image export as the baseline to preserve.

## PR Preview handoff rule

**After opening an implementation PR, surface the latest PR Preview URL to the user in the chat before merge and explicitly state whether the change is user-visible or internal-only.**

Required handoff sequence:

1. Open the PR.
2. Wait for the automatic **PR Preview** deployment for the latest PR head.
3. Retrieve the generated preview URL.
4. Present that URL directly in the active user conversation before merge.
5. Classify the PR as either:
   - **user-visible**: UI/UX, interaction, renderer, preview appearance, animation appearance/behavior, or output changes that can be meaningfully inspected; or
   - **internal-only**: docs-only, tests, CI/config, pure refactor, or runtime/core changes with no meaningful visible Preview difference.
6. For **user-visible** changes, stop after presenting the URL and wait for a new user message that explicitly approves merge.
7. For **internal-only** changes, state that the Preview has no meaningful visible difference. Separate post-Preview approval is not required; after successful CI/Preview gates, merge may proceed in the same turn.
8. Merge only after the normal CI/build gates and the applicable Preview/user-approval gate are satisfied.

Do not treat a GitHub PR comment alone as sufficient handoff. If a Preview is genuinely unavailable or not produced, state that explicitly instead of silently merging.

## Reference-first implementation rule

Before designing or implementing behavior, geometry, expressions, animation, compatibility, rendering, controls, or export semantics related to RoboEyes, first inspect the current implementation in the original **FluxGarage/RoboEyes** repository.

Also inspect representative derivative / port implementations when relevant. Use them to understand how behavior has been interpreted across implementations, not merely how one codebase encodes it.

Preferred decision order:

1. **Original FluxGarage/RoboEyes behavior and implementation**
2. **Representative derivative/port implementations**
3. **Common behavioral/geometric pattern inferred from those references**
4. **Generic, renderer-independent abstraction for this editor**
5. **Project-specific UX improvements**, only when they do not silently change intended RoboEyes-compatible behavior

Do not invent a new behavioral model first and compare it with RoboEyes afterward.

The project does **not** need to copy upstream APIs or internal data structures literally. Translate reference behavior into generic data and keep RoboEyes-specific flags out of the renderer. When the abstraction intentionally differs from upstream internals, document the reason in the Issue or PR.

## Non-negotiable architecture

```text
RoboEyes/style parameters
        ↓
adapter
        ↓
generic FaceModel + generic animation data
        ↓
deterministic evaluator / renderer
        ↓
preview/export
```

Do not let RoboEyes-specific APIs leak into the generic model, SVG renderer, animation runtime, or export layer.

## Current baseline

Preserve these completed capabilities unless the active Issue deliberately changes them:

- generic left/right eye model and single-eye visibility/layout
- RoboEyes adapter
- deterministic SVG renderer
- realtime static editor with the "Quiet Precision" UI (Issue #169)
- direct eye dragging in the enlarged specimen stage (linked = rigid pair, independent = grabbed eye, single-eye layout), clamped by the same safety helpers as the Position sliders; one drag = one undo step (Issue #177)
- rotation pivot choice: local (eye center, or pair midpoint when linked) or display center; both are editor transforms baked into `position` + `rotation`, so the model/renderer are unchanged (Issue #177)
- generic expression model and presets
- deterministic state/spring animation
- blink/wink/open/close/sleep
- auto-blink and idle gaze
- motion primitives and behavior profiles
- ordered state programs
- animation persistence/player controls
- transient effects
- circular display-mask inspection overlay and opt-in clipped export
- optional generic sphere lens distortion for eyes near the display edge; `fit: 'circle'` follows the circular display mask and `fit: 'rect'` preserves rectangular display corners; disabled lenses preserve existing SVG output
- SVG / PNG / animated WebP / GIF export
- static and temporal regression coverage

Do not expand the project into a free-form video/keyframe timeline or generic character studio unless the project direction is deliberately revised.

## Editor UI design language

The editor UI follows "Quiet Precision" (Issue #169). Keep new UI consistent with it:

- Layout: compact header (Undo / Redo / Reset / Export), left outline nav (FACE: Display, Eyes, Expression / MOTION / LIBRARY: Presets / OUTPUT: Export), center specimen stage, right panel showing only the selected section. Desktop columns scroll independently; narrow viewports retain page scrolling and stack header → sticky stage → horizontal section tabs → panel.
- Inspector overscroll (Issue #182): on desktop, once the inspector sits at its bottom/top edge, a detent of further wheel distance (`SECTION_OVERSCROLL_THRESHOLD_PX` = 240 px ≈ 3 notches) switches to the next/previous section without wrapping (next opens at its top, previous at its bottom); a `NEXT` row at the panel end also switches, and a hairline shows progress. Any content scroll, direction reversal, or 350 ms wheel pause restarts the detent; content movement is detected by comparing `scrollTop` with the previous wheel event, because Chromium scrolls before dispatching passive wheel events. There is no post-switch lock: a continuous spin of any delta size (notch, hi-res wheel, trackpad) keeps flowing, one full detent per edge. Edge progress lives in an external store (`OverscrollProgressStore`) so wheel events re-render only the indicators, not the shell. Focused sliders consume their own wheel input first. Logic: `src/ui/editor/sectionOverscroll.ts` (pure tracker) + `useSectionOverscroll.ts` (DOM glue) + `SectionOverscrollIndicators.tsx`. Narrow layouts keep ordinary page scrolling.
- The specimen stage is the visual focus: largest integer scale that fits (fractional only below 1×), a true 1× view, and a `W × H px · transparent|opaque · N×` caption (appending ` · circle mask` when active). Eyes in the enlarged view are draggable; the 1× view is inspection-only. The transport sits under the stage.
- Visual language: light-first warm paper/ink with a single accent; a signal color only for live state. Hierarchy comes from type, spacing, and 1px hairlines. No gradients, cards, pill badges, or radius above 6px; shadows only for overlays. Numbers use tabular/mono digits.
- Styling uses tokens only (`--re-*`, light + `prefers-color-scheme: dark`) in `src/styles/`, with the `re-` class prefix. Respect `prefers-reduced-motion`.
- Numeric sliders (`NumericControl`): only a focused slider consumes the mouse wheel (up/right = increase; one step per notch-sized event, small trackpad deltas accumulate to 100 px; `step="any"` uses a 1-2-5 step near 1/100 of the range within [0.01, 1]; Shift ×10). Unfocused sliders never intercept page scrolling. A wheel sequence is one undo step; pointer/key gestures and blur close a pending wheel sequence first (`WheelSliderSession`, Issue #179).
- Code layout: `src/ui/editor/useEditorController.ts` owns editor state and actions; `src/ui/editor/EditorShell.tsx` is the view; stage in `src/ui/stage/`, sections in `src/ui/sections/`. Sections reuse the existing control components and safety helpers instead of duplicating logic.

## Small-display requirements

Treat these as first-class constraints:

- exact/fixed canvas dimensions
- 128x64, 128x128, 240x240, 320x240, 320x320, custom
- transparent background
- deterministic geometry and rasterization
- architecture that remains compatible with pixel-perfect / nearest-neighbor inspection workflows

## Renderer rule

The renderer must be deterministic: the same `FaceModel` and overlay input must produce the same visual output.

Random behaviors, scheduling, and logical time belong in animation/state logic, never inside the renderer.

## Animation rule

Animation is based on explicit logical time, seed, runtime events, and serializable authoring data:

```text
state + transition + behavior/program
        ↓
deterministic resolved frame
        ↓
renderer
```

Do not make semantics depend on browser frame cadence, hidden mutable renderer state, `Math.random()`, or wall-clock time.

## Development discipline

- Work issue-by-issue.
- **Use an Issue-first workflow for bugs, improvements, behavior changes, and feature work.** Create or identify the GitHub Issue before starting the implementation PR.
- Record the reproduction/need, expected behavior, and acceptance criteria in the Issue when applicable.
- Create the implementation PR from that Issue and link it with a closing keyword such as `Fixes #123` or `Closes #123` when the PR should complete the Issue.
- Do not normally create a PR first and backfill the Issue afterward. Trivial typo-only or clearly non-behavioral documentation fixes may be handled without an Issue.
- Keep changes narrowly scoped.
- Add tests around model/adapter/renderer/animation/export behavior as appropriate.
- Update docs when a design decision changes.
- Before any implementation PR is merged, surface the latest PR Preview URL directly to the user and classify the change as user-visible or internal-only.
- Never merge a user-visible change in the same response/turn in which its Preview URL is first presented.
- Do not merge a user-visible change while its PR Preview is failed, cancelled, stale, or unavailable.
- When visual feel or interaction behavior matters, obtain manual confirmation from the PR Preview before merging. CI test/build is still required.
- If implementation pressure conflicts with `docs/direction.md`, do not silently change the architecture; surface the conflict and update the design deliberately.
