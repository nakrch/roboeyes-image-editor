# Animation editor and preview semantics

Issue: #107

## Separation of authored state and resolved preview state

The browser editor keeps two different kinds of state:

```text
authored FaceModel + animationDefaults
        ↓ deterministic evaluator(time, seed, events)
resolved preview FaceModel
        ↓
SVG preview
```

The resolved preview frame is temporary. It is never written back into the authored `FaceModel`, never sent through the parameter controls, and never appended to Undo/Redo history per animation frame.

Static parameter edits, Expression edits, behavior settings, seed changes, and sequence edits are authored changes and use normal editor history. Playback position, play/pause state, browser frame timestamps, and manual one-shot progress are runtime-only.

## Playback clock

Realtime playback uses `requestAnimationFrame` only to supply elapsed real time to the deterministic playback clock. Core animation evaluation still samples explicit logical `timeMs`.

- **Play**: continue from the current logical position.
- **Pause**: preserve the current logical position.
- **Stop**: clear manual runtime events and reset logical position to zero.
- **Restart**: clear manual runtime events, reset logical position to zero, and play.
- **Speed**: changes logical-time advancement without modifying authored animation data.

When the document becomes hidden while playing, the editor pauses the logical clock and remembers that playback was active. When visible again it resumes from the preserved logical position. Hidden wall-clock time therefore does not cause a jump. A session deliberately paused before hiding stays paused.

Applying, importing, or resetting a face preset clears runtime one-shots and resets the playback session. Preset animation authoring data remains whatever the preset contains.

## Manual triggers

Blink, left/right Wink, Open, Close, Sleep, Confused, and Laugh are emitted as explicit runtime events at the current logical time. They use the same generic `eye-openness` and `motion-offset` channels as the Phase 3 runtime and are not renderer branches.

Manual triggers are runtime-only and do not dirty preset JSON or Undo/Redo history. Triggering while stopped starts playback so a one-shot can visibly progress.

`Close` and `Sleep` are intentionally persistent until an explicit `Open`. `Close` enters the generic closed state with the normal short close transition. `Sleep` uses a slower editor transition and records the distinct semantic `sleep` state. Their fully closed final geometry is intentionally the same; the distinction is state meaning for behavior/program composition rather than a separate renderer shape.

The core RoboEyes-compatible Confused primitive retains its reference amplitude. The editor's manual Confused button applies a smaller payload override so interactive preview is less visually extreme without changing the reusable core primitive.

## Behavior authoring

The editor exposes:

- stable authored seed and explicit reseed
- built-in behavior profile selection
- auto-blink enable/interval/variation
- idle wander enable/interval/variation
- continuous H/V motion amplitude, period, and waveform
- lightweight ordered state sequences
- per-step Expression target, transition duration/easing, and hold duration
- sequence reorder/add/delete and once/loop/ping-pong playback mode

Behavior profiles keep their optional recommended Expression identity separate from the authored static Expression. In the realtime Preview, a profile's recommended Expression is applied as a temporary preview layer so profiles such as Frozen-like and Angry are visually distinguishable. The authored `FaceModel.expression` and Expression preset identity are not overwritten.

All authored changes are persisted through the versioned `FacePreset.animationDefaults` schema from #105.

## Sequence and ambient composition

The #112 program resolves the state portion first at the requested logical time. Its generic one-shot actions are materialized as runtime events. Ambient/profile channels are then evaluated using the existing Phase 3 composition order.

Direct authored channel settings override the corresponding behavior-profile channel. This allows a profile to provide defaults while the editor can explicitly customize auto-blink, idle, or continuous motion without renderer knowledge of profile names.

When an Expression target is changed on any sequence step, the editor clears manual runtime one-shots, pauses playback, and seeks to that step's first forward hold frame. This makes Step 2 and later Expression targets immediately visible without waiting for normal sequence playback. The seek changes only runtime playback position; it does not mutate the authored step data beyond the requested Expression edit.

## Reduced motion

When `prefers-reduced-motion: reduce` is active, automatic/profile ambient channels are suppressed **only in realtime editor preview**. This does not rewrite serialized animation data, change the deterministic runtime/export semantics, or disable direct manual triggers and sequence-state inspection. A behavior profile's recommended static Expression may still be shown because it is not temporal motion.

The editor shows a notice while this preview policy is active. Static editing and keyboard/native control interaction remain available.

## Visual regression gallery

The Visual Regression Gallery remains based on static deterministic fixtures. Phase 3 playback does not mutate those fixtures or add frame-by-frame gallery state.
