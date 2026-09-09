# Deterministic auto-blink

Issue #101 layers RoboEyes-style automatic blinking on top of the deterministic scheduler from #98 and the manual eye-openness blink primitive from #100.

## Reference basis

The implementation follows the common RoboEyes-family behavior while replacing wall-clock and mutable RNG state with explicit deterministic sampling:

- FluxGarage/RoboEyes V1.1.1 stores a base `blinkInterval` plus `blinkIntervalVariation`; when an automatic blink fires it calls the normal `blink()` path and schedules the next blink as `base + random(additional variation)`.
- `mchobby/micropython-roboeyes` preserves the same auto-blinker concept and manual blink/wink separation.
- `winsonwq/robo-eyes` separates randomized blink timing from the visual blink controller.

This project keeps those responsibilities separate:

```text
serializable auto-blink config
        +
explicit time + seed + enable/disable events
        ↓
deterministic scheduled `blink` events
        ↓
#100 eye-openness blink primitive
        ↓
FaceModel
        ↓
renderer
```

No timer, `Date.now()`, `performance.now()`, `Math.random()`, or renderer frame count participates in scheduling semantics.

## Serializable configuration

Auto-blink is authored inside the existing `eye-openness` channel:

```ts
{
  kind: 'eye-openness',
  autoBlink: {
    enabled: true,
    startTimeMs: 0,
    intervalMs: 1000,
    variationMs: 4000,
  },
}
```

The interval wording is intentionally explicit:

- `intervalMs` = **minimum/base delay** between automatic blinks
- `variationMs` = **additional deterministic delay range** sampled from `[0, variationMs)`

Therefore each delay is in `[intervalMs, intervalMs + variationMs)`.

Reference-compatible defaults are:

- disabled by default
- logical origin `startTimeMs = 0`
- base/minimum interval `1000 ms`
- additional variation `4000 ms`

`variationMs = 0` is valid and produces an exact fixed interval.

## First blink

When an auto-blink epoch becomes enabled, the first blink is not immediate. It occurs after one complete sampled delay from that epoch's start time:

```text
enable time + intervalMs + seeded variation
```

This makes initial scheduling explicit and seekable. It intentionally avoids relying on the original library's mutable `blinktimer` initialization state.

## Seeded schedule

Auto-blink uses the #98 deterministic interval scheduler and the dedicated `auto-blink` random namespace. Each enable epoch receives its own derived substream.

For identical:

- auto-blink definition
- runtime enable/disable events
- explicit `timeMs`
- animation seed

the generated blink timestamps are identical regardless of render cadence or which timestamps were sampled previously.

Different seeds may produce different schedules, but every generated delay remains inside the configured base-plus-variation bounds.

## Runtime enable / disable

The `eye-openness` runtime channel additionally accepts control records:

- `auto-blink-enable`
- `auto-blink-disable`

`auto-blink-enable` starts a new deterministic schedule epoch at that event's `startTimeMs`. Its payload may override:

```ts
{
  intervalMs,
  variationMs,
}
```

If auto-blink is already enabled, another `auto-blink-enable` is treated as a deterministic restart/reconfiguration from that explicit timestamp.

`auto-blink-disable` stops the active epoch immediately. A scheduled blink exactly at the disable timestamp is suppressed.

Re-enabling starts a new epoch, so its first blink is scheduled one complete delay after the new enable timestamp.

Behavior profiles (#104) use this event/data model to change blink cadence without renderer mood branches.

## Manual blink and wink interaction

Manual `blink`, `wink-left`, and `wink-right` do **not** reset, postpone, or otherwise consume the automatic schedule. This mirrors the reference separation between manual blink commands and the auto-blink timer.

If a manual event and automatic blink occur at exactly the same timestamp, the generated auto-blink is assigned a lower runtime priority than default manual events. The normal #98 event ordering therefore lets the explicit manual event win the simultaneous conflict deterministically.

## Closed / sleep interaction

Persistent `close` and `sleep` do not pause or rewrite the deterministic schedule.

Automatic blink timestamps that occur while an eye is persistently closed/sleeping are still part of the logical schedule, but #100 ignores their `blink` primitive because the persistent eye-openness state is not open.

When the eyes reopen:

- suppressed past slots are not replayed
- the schedule is not shifted
- the next future scheduled slot remains deterministic

This prevents closed/sleep state from corrupting future random scheduling.

## Reuse of #100 blink behavior

Auto-blink never modifies eye geometry directly. It materializes ordinary `eye-openness` `blink` events and sends them through the same #100 resolver used by manual blinking.

Consequently automatic blinking inherits the same:

- close / hold / open timing
- easing
- vertical centering
- expression preservation
- retrigger behavior

There is no second auto-blink renderer or visual code path.

## Determinism and seeking

Scheduling is reconstructed from authored config, runtime control events, explicit time, and seed. There is no hidden mutable "next blink" cursor.

Direct seek to 20 seconds and incremental playback to 20 seconds resolve the same scheduled blink history. Sampling 20 seconds before 5 seconds does not change the 5-second result.

## Layer boundary

Auto-blink scheduling remains separate from the browser authoring/playback UI (#107), behavior-profile composition (#104), and idle-gaze scheduling (#102). Those completed layers consume the same deterministic channel/event contracts rather than changing auto-blink semantics.
