# Deterministic animation runtime

This document defines the Phase 3 runtime contract introduced by Issue #98. Detailed behavior schemas for transitions, blink, idle, motion, sequences, and persistence are owned by their respective companion specifications and issues.

## Reference basis

The runtime preserves the useful separation patterns found in RoboEyes implementations while deliberately changing their timing semantics:

- FluxGarage/RoboEyes uses target (`Next`) and rendered (`Current`) state, plus `millis()` and `random()` scheduling in the update/draw path.
- `mchobby/micropython-roboeyes` adds `StepData` / `Sequence` / `Sequences`, keeping elapsed-time sequence scheduling outside the actual drawing primitives.
- `winsonwq/robo-eyes` centralizes animation/tween/controller updates behind an animation system.

For this browser editor, renderer cadence and wall-clock state must not define animation behavior. The runtime therefore uses explicit logical time, indexed deterministic randomness, and plain runtime-event data.

## Frame sampling contract

The canonical frame inputs are:

```text
base FaceModel
+ serializable AnimationDefinition
+ RuntimeAnimationEvent[]
+ explicit timeMs
+ uint32 seed
        ↓
evaluateAnimationFrame(...)
        ↓
resolved FaceModel/frame state
        ↓
existing deterministic renderer
```

`timeMs` must be finite and non-negative. Fractional milliseconds are valid so callers can sample exact frame intervals such as 1000/60 ms.

The animation seed is an unsigned 32-bit integer from `0` through `4294967295`. Inputs outside that range, non-integers, `NaN`, and infinities are rejected rather than silently coerced.

Sampling is side-effect free from the caller's perspective. The evaluator clones the input `FaceModel`; temporary animation resolution must never rewrite the authored/static model.

## Authored definition vs runtime events

`AnimationDefinition` is versioned JSON-safe authoring data. Issue #98 defines the stable envelope and composition channels; channel-specific schemas are defined by the companion behavior modules/specifications.

`RuntimeAnimationEvent` represents ephemeral ad-hoc triggers such as manual blink/wink/laugh/confused. Each event contains:

- stable `id`
- composition `channel`
- action/type string
- explicit `startTimeMs`
- caller-owned non-negative integer `order`
- optional integer `priority`
- optional JSON-safe payload

Runtime events are not automatically persisted as authored preset data. Authored sequence steps from #112 are a separate concept even when they compile/resolve to equivalent scheduled actions.

Duplicate runtime-event IDs are invalid.

## Event order, conflict, and retrigger rules

Events are normalized in this stable order:

1. `startTimeMs` ascending
2. composition channel order
3. `priority` ascending
4. caller `order` ascending
5. `id` code-point order

For a channel that uses dominant/latest-event semantics, the last applicable event wins. Therefore:

- a later start time retriggers/replaces an earlier same-channel event;
- at the same start time, higher priority wins;
- at equal priority, higher caller order wins;
- `id` is the final deterministic tie-break.

Specific behaviors may define richer overlap semantics in their owning issues, but they must remain deterministic and explicitly documented.

## Composition order

The runtime fixes this order:

1. base static geometry/expression
2. state/model transitions
3. gaze/pose behavior
4. eye openness/blink
5. temporary motion offsets
6. transient effects

Code identifiers:

```text
base
state-transition
gaze-pose
eye-openness
motion-offset
transient-effect
```

Channel resolvers execute only in this order, regardless of object/map insertion order. Runtime events are supplied only to their matching channel.

## Deterministic random substreams

Random behavior uses stateless indexed sampling:

```text
sampleRandom(seed, streamName, eventIndex)
```

A named stream derives its own deterministic 32-bit seed. Sampling `idle-gaze` therefore cannot consume or reorder samples from `auto-blink`. This keeps independent schedulers stable when other random behaviors are enabled or disabled.

No core animation implementation should depend on `Math.random()`.

## Deterministic interval scheduler

The generic interval scheduler uses:

- named stream
- logical start time
- minimum/base interval
- additional variation
- event index

The delay before each event is:

```text
intervalMs + deterministic variation in [0, variationMs)
```

Event times are derived from deterministic event indices rather than browser frame count. Direct seeking may enumerate prior scheduled events, but it never needs to replay `requestAnimationFrame` ticks or renderer frames from time zero.

## Playback clock

The playback clock is a pure state helper. It stores logical position, playback rate, and stopped/playing/paused status.

It does **not** read:

- `Date.now()`
- `performance.now()`
- `requestAnimationFrame`

The browser preview layer provides elapsed realtime to `advancePlaybackClock()`. Realtime orchestration, pause/resume, and document-visibility policy stay outside the pure evaluator, so browser timing does not change animation semantics.

## Static compatibility

With no authored channel data and no runtime events, `evaluateAnimationFrame()` returns an independent model copy with geometry/render output equivalent to the original static `FaceModel`.

`renderFaceToSvg()` remains timer-free and random-free.

## Capability ownership

The completed Phase 3 capability split remains:

- #99: state/model interpolation and easing implementations
- #100: eye openness, blink/wink/open/close/sleep
- #101: auto-blink scheduler semantics
- #102: idle gaze scheduler/targets
- #103: temporary motion offsets and one-shots
- #104: behavior profiles
- #112: authored multi-step state programs
- #105: persisted animation schema/preset integration
- #107: realtime player/UI clock orchestration
- #108: temporal regression and frame-rate independence
- #106/#113: transient-effect/spring extensions
