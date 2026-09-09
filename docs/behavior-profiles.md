# Temporal behavior profiles

Issue #104 demonstrates that Phase 3 behaviors can be composed as data without adding renderer-level mood/profile branches.

## Separation of concerns

A behavior profile contains:

- a stable profile id/name,
- an optional **recommended** static Expression preset id,
- a serializable `AnimationDefinition` assembled from generic channels.

It does **not** own or mutate the Expression preset itself.

```text
static/user Expression
        +
behavior profile animation data
        ↓
Phase 3 channel resolvers
        ↓
resolved FaceModel
        ↓
renderer
```

This means a user-authored expression can be combined with any compatible temporal profile. Applying/removing a profile does not rewrite the underlying expression.

## Reference basis

The initial vocabulary is inspired by RoboEyes derivatives/ports rather than copied as renderer-specific modes:

- `mchobby/micropython-roboeyes`
  - FROZEN: neutral/static eye shape + horizontal shake
  - SCARY: tired/partly closed eye shape + vertical shake
  - CURIOUS: gaze-reactive static shape plus temporal behavior
- `willrnsantana/robo_eyes_esphome`
  - default: slow wander + auto blink
  - curious/confused: faster, more restless motion
  - happy: gentle motion + faster blink
  - angry: centered/tense motion with blink suppressed
  - closed: persistent close
- `winsonwq/robo-eyes`
  - static mood data remains separate from animation tags/temporal behavior

Exact timing/range values below are project defaults chosen to express the same behavior vocabulary in the generic Phase 3 runtime; they are not claimed as byte-for-byte derivative constants.

## Built-in profiles

### Default / Idle

- auto blink: moderate interval/variation
- idle gaze: slow bounded wander
- no required expression

### Frozen-like

- recommends Neutral expression
- continuous horizontal square-wave shiver

### Scary-like

- recommends Tired expression
- continuous vertical square-wave shiver

### Curious

- recommends Curious expression
- faster auto blink
- faster/wider deterministic idle gaze

### Happy

- recommends Happy expression
- moderately faster blink/wander
- gentle continuous vertical sine bounce

### Angry

- recommends Angry expression
- no auto blink channel
- gaze is pulled toward the center through a degenerate idle-gaze range
- continuous small horizontal shiver

### Closed / Sleep

- persistent `sleep` state on the generic eye-openness channel

### Confused

- recommends Neutral expression
- fast auto blink
- fast deterministic gaze wander
- continuous seeded horizontal jitter

## Continuous profile motion

Issue #103 defines temporary motion primitives. Profiles also need persistent shiver/bounce while a profile remains active, so #104 adds a small authored `continuous-motion` channel definition that reuses the same #103 axis/amplitude/period/phase/waveform sampler.

Runtime one-shot motion events still override the continuous baseline. A `motion-stop` event suppresses it explicitly.

No renderer knows the profile name or `continuous-motion` kind; the animation resolver converts it into a resolved `FaceModel` before rendering.

## Serialization and editor integration

Profiles are versioned plain JSON-safe data. A new profile can be created by providing a new id/name plus an `AnimationDefinition` using existing generic channel schemas. No renderer modification is necessary.

Preset/serialization integration (#105) persists the profile through `animationDefaults`, and the browser authoring UI (#107) exposes the built-in profile selector. The optional recommended Expression remains a preview-layer recommendation: selecting or removing a profile does not overwrite the authored static Expression.
