# Deterministic idle gaze

Issue #102 adds generic idle/random gaze behavior on top of the deterministic Phase 3 runtime (#98) and FaceModel transition system (#99).

## Reference basis

The implementation keeps the common RoboEyes-family behavior while replacing mutable timers and random state with explicit-time evaluation:

- FluxGarage/RoboEyes V1.1.1 chooses a random legal X/Y target when idle is active, then schedules the next reposition from a minimum interval plus an additional random variation.
- The original idle timer starts at zero, so enabling idle causes a target to be selected on the next update instead of waiting for one full interval first.
- `mchobby/micropython-roboeyes` preserves the same idle interval + variation concept.
- Other RoboEyes-derived implementations similarly separate target choice from smooth movement toward the target.

This editor keeps those semantics in generic gaze units and uses the existing #99 transition/easing system instead of RoboEyes' frame-dependent current→next smoothing.

## Authored definition

The `gaze-pose` channel accepts an idle-gaze definition:

```ts
{
  kind: 'idle-gaze',
  enabled: true,
  startTimeMs: 0,
  intervalMs: 1000,
  variationMs: 3000,
  transitionDurationMs: 350,
  easing: 'ease-in-out',
  xRange: { min: -10, max: 10 }, // optional
  yRange: { min: -5, max: 5 },  // optional
}
```

`xRange` / `yRange` are absolute generic `FaceModel.gaze` units. If an axis range is omitted, the full canvas-safe range for that axis is used.

Ranges may be degenerate (`min === max`) for deterministic fixed targets. An authored range with `min > max` is rejected. If an authored range has no intersection with the current canvas-safe range, evaluation fails deterministically instead of generating an invalid off-canvas target.

## Scheduling semantics

Idle gaze uses three independent seeded random substreams per enable epoch:

- timing
- X target
- Y target

This keeps idle sampling isolated from auto-blink and other random behaviors.

The first target is selected at the idle enable/start timestamp. The transition starts from the incoming authored/manual gaze at that same timestamp, so there is no snap.

Subsequent target times use:

```text
next target delay = intervalMs + seeded variation in [0, variationMs)
```

`variationMs = 0` therefore produces exact fixed intervals.

## Movement and retargeting

Every target movement is represented with the #99 FaceModel transition system:

```text
current resolved FaceModel
        ↓
FaceTransitionDefinition { target: { gaze }, duration, easing }
        ↓
sampleFaceTransition(time)
```

If a new idle target arrives before the previous transition has finished, the new transition is rebased from the exact resolved gaze at that target timestamp. The result is continuous and does not depend on browser frame cadence or prior sampling order.

## Canvas safety and Curious

Target generation always intersects the authored X/Y bounds with the existing generic `gazeLimits()` for the current FaceModel.

Curious can change eye height as horizontal gaze grows, which can in turn tighten canvas-safe gaze limits. Target resolution therefore re-evaluates those limits using the candidate gaze and iteratively clamps until the candidate is safe for its own gaze-reactive geometry.

This keeps idle targets inside both:

1. the configured idle range, and
2. the actual renderer/model canvas-safe range.

Because idle changes ordinary `FaceModel.gaze`, Curious continues to react through the existing generic expression logic; there is no idle-specific Curious branch.

## Runtime control and manual gaze ownership

The `gaze-pose` channel recognizes two explicit runtime controls:

- `idle-gaze-enable`
- `idle-gaze-disable`

An enable event starts a fresh deterministic epoch at the event timestamp and may override interval, variation, transition duration, easing, and X/Y ranges through its payload.

A disable event takes effect at its exact timestamp. Once disabled, the idle resolver returns the incoming FaceModel unchanged. This intentionally returns control to the authored/manual/state-transition gaze without leaving hidden offsets.

Manual/authored gaze changes while idle is active remain part of the incoming FaceModel and therefore form the base/origin from which the deterministic idle evaluation is resolved. Idle temporarily owns the visible gaze while enabled; disabling exposes the current authored/manual gaze immediately.

## Determinism contract

For identical:

- incoming FaceModel,
- idle definition,
- runtime control events,
- explicit `timeMs`, and
- animation seed,

idle evaluation returns the same target schedule, target positions, and resolved FaceModel.

There is no `Date.now()`, `performance.now()`, `Math.random()`, frame counter, or mutable renderer state in idle evaluation.

## Scope boundary

Issue #102 does not add:

- UI controls or live playback authoring (#107)
- behavior-profile presets such as slow/fast wander (#104)
- Confused/Laugh motion primitives (#103)
- reusable state programs (#112)
- a RoboEyes 9-position-only idle mode; the generic bounded target model is the core abstraction, and adapter/preset data can add compatibility-oriented target modes later if needed

Those features can reuse the deterministic gaze-pose runtime added here.
