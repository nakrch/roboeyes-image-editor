# Animation persistence and preset integration

Issue #105 activates the existing `FacePreset.animationDefaults` boundary as the persistent authoring container for Phase 3 animation data.

## Compatibility rule

Phase 1/2 presets already store:

```json
"animationDefaults": {}
```

That exact empty object remains valid and unchanged. `FacePreset.version` therefore remains `1`; animation authoring data has its own versioned envelope only when it is non-empty.

```ts
{
  version: 1,
  seed?: number,
  definition?: AnimationDefinition,
  behaviorProfile?: BehaviorProfile,
  program?: AnimationProgram,
}
```

No parallel face-preset format is introduced.

## Persisted authoring data

The envelope may contain:

- `seed` — stable authored/default uint32 seed for reproducible random behavior;
- `definition` — generic ambient channel data such as auto-blink, idle gaze, authored state transition, or continuous profile motion;
- `behaviorProfile` — a reusable #104 temporal behavior profile with stable identity;
- `program` — a reusable #112 ordered state/action program with stable program, step, and action identities.

Easing and playback behavior are stored as stable string IDs such as `ease-in-out`, `once`, `loop`, and `ping-pong`, never executable functions.

## Seed ownership

The persisted `seed` is **authoring/default state**. It means "start this preset with this deterministic random identity."

The following are runtime-only and are deliberately absent from the persistence schema:

- current playback position / elapsed time;
- paused/playing status;
- active one-shot events;
- current blink/idle schedule progress;
- PRNG cursor/sample cursor;
- resolved in-flight transition rebase snapshots;
- requestAnimationFrame/frame count state.

`initializePresetAnimation()` creates fresh deterministic runtime inputs from authoring defaults and defaults the seed to `0` when no seed is authored. It does not create or serialize runtime progress.

A UI reseed operation should update only `animationDefaults.seed`; it must not rewrite static geometry/expression fields.

## Strict validation

Preset JSON import/export and local custom-preset storage use the same validator.

The persistence layer rejects:

- unsupported animation-default versions;
- unsupported top-level fields;
- non-finite/out-of-range seeds;
- unknown authored channel fields;
- unsupported channel schemas;
- runtime `from` snapshots on persisted state transitions;
- unknown nested state-target fields;
- unsupported future `transient-effect` data until that channel receives its own persistence schema.

Known channel data is normalized by the owning Phase 3 module rather than merely checked for generic JSON compatibility.

This prevents executable data or hidden runtime state from being smuggled into authoring JSON.

## Face preset save/load

The following paths all normalize `animationDefaults`:

- `createCustomPreset()` when authored animation defaults are supplied;
- `serializePreset()`;
- `parsePreset()`;
- `saveCustomPresets()`;
- `loadCustomPresets()`.

Existing callers of `createCustomPreset()` need no changes: the optional animation argument is appended after the existing arguments, and omitted animation still stores `{}`.

As before, local storage loading skips an invalid individual preset instead of making the entire saved preset list unusable.

## Identity stability

`BehaviorProfile.id`, `AnimationProgram.id`, program step IDs, and program action IDs round-trip without regeneration. Reordering steps changes array order only; stable identities remain intact and do not depend on array indexes.

This prepares animation data for later editor reorder/edit operations without introducing a full project-document system.

## Applying defaults

Applying a preset initializes animation behavior from the persisted definition/behavior/program and authored seed. The initializer clones reusable data and leaves the static `FaceModel` untouched.

If `animationDefaults` is `{}` or the persisted generic definition is disabled/absent, static preset behavior remains identical to Phase 1/2.

Visible animation authoring and reseeding controls are intentionally deferred to #107.
