# Deterministic spring transitions

Issue: #113

## Reference basis

- FluxGarage/RoboEyes keeps separate current/next eye state and smooths current values toward targets on each embedded update. That behavior establishes the target-state motion intent, but its `(current + next) / 2` style smoothing is frame-cadence dependent and is not copied literally here.
- Phase 3 already converts that intent into explicit-time easing transitions in `src/animation/transition.ts`.
- Mote Studio is used only as a workflow reference for interruptible spring-like transitions that retarget from the state already on screen. This project keeps the implementation renderer-independent and small-display focused.

## Model

Spring timing is a damped unit-step response with JSON-safe physical parameters:

- `stiffness > 0`
- `damping >= 0`
- `mass > 0`

`springResponse(parameters, elapsedMs)` uses a closed-form solution for underdamped, critically damped, and overdamped systems. It does not integrate browser frames, retain hidden mutable solver state, or depend on `requestAnimationFrame` cadence.

Built-in authoring presets are plain data:

- `gentle`
- `snappy`
- `bouncy`

They are conveniences, not renderer behavior names.

## Generic transition interface

Existing easing transitions remain valid as `FaceTransitionDefinition`. Spring transitions use `SpringFaceTransitionDefinition`; both are accepted by `GenericFaceTransitionDefinition` and sampled through `sampleGenericFaceTransition()`.

`genericStateTransitionChannelResolver` is the normal runtime adapter for the `state-transition` channel. It reads the channel-specific serialized definition and dispatches to easing or Spring sampling by `kind`.

Both transition kinds target the same generic `FaceStateTarget` surface and therefore support gaze, eye geometry/pose, spacing, rotation, and expression numeric fields without expression-name branches.

## Persistence

Persisted `state-transition` channel data accepts either:

```ts
{
  kind: 'face-model-transition'
  id: string
  startTimeMs: number
  durationMs: number
  easing: EasingId
  target: FaceStateTarget
}
```

or:

```ts
{
  kind: 'spring-face-model-transition'
  id: string
  startTimeMs: number
  durationMs: number
  spring: {
    stiffness: number
    damping: number
    mass: number
  }
  target: FaceStateTarget
}
```

Runtime retarget snapshots such as `from` remain non-persistent. Unknown fields inside the Spring parameter object are rejected by the strict preset validator.

## State-program authoring

Ordered state programs keep the existing `easing` field as the compatibility/default transition mode. A step becomes a Spring entry transition only when it also contains serialized `spring` parameters:

```ts
{
  id: 'happy'
  target: { expression: happyExpression }
  transitionDurationMs: 500
  easing: 'ease-in-out' // retained for compatibility/fallback
  spring: { stiffness: 180, damping: 12, mass: 1 }
  holdDurationMs: 600
}
```

Existing programs without `spring` are therefore unchanged and continue to use easing.

The browser State sequence editor exposes:

- `Transition type`: `Easing` or `Spring`
- `Easing`: existing easing IDs when Easing is selected
- `Spring preset`: `gentle`, `snappy`, or `bouncy` when Spring is selected

Selecting a Spring preset writes its explicit `stiffness` / `damping` / `mass` values into the authored program. Imported custom Spring parameter sets remain valid; the editor labels them as custom rather than silently replacing them.

## Preview and animated export

The editor preview resolves Spring program steps through `sampleAnimationProgram()` and serialized `state-transition` channels through `genericStateTransitionChannelResolver`.

Animated WebP/GIF export uses the same deterministic editor frame resolver at explicit timestamps, so authored Spring behavior is shared by preview and animated export rather than being reimplemented in an encoder-specific path.

## Seeking and retargeting

A Spring transition is sampled directly from `startTimeMs`, the requested logical `timeMs`, and its serialized Spring parameters. Sampling time 420 ms directly is therefore equivalent to sampling many earlier timestamps and then 420 ms.

`retargetSpringFaceTransition()` first resolves the exact in-flight model at the retarget timestamp and stores that model as the new transition's explicit `from` state. Sampling the replacement transition at the retarget timestamp is byte/geometry-equivalent to the state immediately before retargeting, so there is no position snap.

The new Spring begins with zero implicit velocity. Position continuity is guaranteed; velocity continuity is deliberately not hidden as mutable runtime state.

## Duration and safety

`durationMs` remains the authored hard completion boundary. Before that boundary the physical Spring response determines progress; at the boundary the exact target state is returned.

Underdamped Spring math may overshoot above 1. The physical response remains observable through `springResponse()`, but FaceModel sampling clamps interpolation progress to the established `0..1` model boundary. This deliberately prevents Spring overshoot from bypassing gaze/canvas and eyelid-aperture safety constraints. Renderer code remains timer-free and physics-free.

State-program Spring sampling uses the same response and safe `interpolateFaceModel()` boundary, so program transitions cannot bypass the established model invariants either.

## Reduced motion

Spring definitions are authoring data and are never rewritten by OS accessibility preferences.

The editor's existing reduced-motion policy suppresses automatic authored definition/profile motion in preview while leaving serialized data untouched. Ordered state-program authoring remains explicit user-authored playback data and continues to use its selected easing/Spring semantics. Deterministic export and direct logical-time sampling never mutate the serialized Spring definition.
