# Measured results — 2026-11-27

> **Scope:** one fictional task, four arms, 3 trials each, one pinned model.
> These are real provider-reported measurements, but they are **not** a general
> benchmark and must not be compared with figures from other workloads.

## Run identity

| Field | Value |
|---|---|
| Provider | `openrouter:anthropic/claude-sonnet-4.5` |
| Model pin | `anthropic/claude-sonnet-4.5` (Vercel did not name an exact Sonnet version — family pin, not an exact-match claim) |
| Pins SHA-256 | `bbb93c88bd72…` (full digest in the result JSON) |
| Fixture SHA-256 | `0b03f1be6588…` |
| Prompt | `prompt.txt`, identical for all arms |
| Success check | `src/verdict.mjs`, identical for all arms |
| Trials declared | 3 per arm, before the run |
| Raw result | `results/measured-2026-11-27T07-57-10-789Z.json` (local; gitignored) |

## Results (median [min, max] over 3 trials)

| Arm | Correct | Turns | Context chars | Model ms/turn | **Arm mechanics ms** | Wall ms | Prompt tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
| Contract (`sure-state`) | **3/3** | 2 | 4,843 | 1,218 [1,116,1,299] | **0.51 [0.48, 2.19]** | 2,446 [2,241,2,629] | 2,463 |
| DOM / aria snapshot | **3/3** | 2 | 13,198 | 1,239 [1,186,1,314] | **251.76 [250.58, 290.03]** | 2,756 [2,654,2,958] | 6,492 |
| UI SDK bridge (`snapshot`) | **3/3** | 2 | 4,701 | 1,312 [1,129,1,315] | **224.48 [194.02, 240.50]** | 2,860 [2,540,2,892] | **2,391** |
| UI SDK bridge (`query`) | **3/3** | 4 | **2,664** | 1,333 [1,250,1,341] | **228.39 [227.32, 277.76]** | 5,522 [5,437,5,562] | 2,574 |

**Arm mechanics** is timed directly around each `observe()` and `apply()` call.
It is **not** wall clock minus model time. Model time is measured only around
the provider call and includes network latency.

## What the numbers actually say

1. **Against browser tools, the contract arm is clearly cheaper:** ~2.7× fewer
   context characters and ~2.6× fewer prompt tokens than the DOM arm, with 2
   turns in both cases. That is the largest effect in this run.
2. **Against the component bridge, we do NOT win.** The bridge used slightly
   *fewer* characters (4,701 vs 4,843) and fewer tokens (2,391 vs 2,463) than
   the contract arm. Claiming a token advantage over a component bridge from
   this data would be false.
3. **The `query()` bridge has the smallest per-turn payload (2,664 chars) but
   needs 4 turns** and ends up slightly above the plain bridge in total tokens
   (2,574 vs 2,391) and more than 2× its wall clock. Less context per turn is
   not the same as less total context.
4. **Model latency hides the architectural difference in wall clock.** It is
   ~1.2–1.3 s of roughly 2.4–2.9 s wall clock for the 2-turn arms. That is why
   we now time the arm side directly: the contract arm spends **0.51 ms** in
   observe+apply per trial, versus **224 ms** for the component bridge and
   **252 ms** for the DOM arm — roughly **400–500× less interface work**. This
   is a real, measured difference, but it is *interface mechanics*, not a claim
   about end-to-end speed: the model call dominates the user-visible latency
   in every arm, and Arm C has no presentation layer by design. Report the two
   columns together; do not quote one without the other.
5. **All arms passed 3/3.** No correctness difference was demonstrated on this
   task. The contract arm's server-enforced version fence is a stronger
   *guarantee* (an agent cannot forge or race the version), but this workload
   did not stress it. Do not present it as a measured accuracy win.

## Limitations — read before quoting

- One task, one model, 3 trials. Medians have no spread on deterministic
  payloads; no confidence interval is claimed.
- Our task (20-row ledger) is much smaller than Vercel's settings screen
  (24 members, menus, dialogs), so absolute numbers here are **not**
  comparable to their published table.
- Context characters are not tokens; both columns are reported separately and
  are never converted into one another.
- The key was read from an ignored local file; no secret appears in any commit,
  result file or log.

## Reproduce

See `README.md` → "A measured run needs a real provider". Use the same pins and
`--trials=3`; `assertComparable()` will refuse to mix this run with a different
model, pins digest or fixture.
