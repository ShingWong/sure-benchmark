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
| Raw result | `results/measured-2026-11-27T07-39-47-532Z.json` (local; gitignored) |

## Results (median [min, max] over 3 trials)

| Arm | Correct | Turns | Tool calls | Context chars | Provider latency ms | Wall clock ms | Prompt tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
| Contract (`sure-state`) | **3/3** | 2 [2,2] | 2 [2,2] | 4,843 [4,843,4,843] | 1,216 [1,197,1,234] | 2,439 [2,422,2,475] | 2,463 [2,463,2,463] |
| DOM / aria snapshot | **3/3** | 2 [2,2] | 2 [2,2] | 13,198 [13,198,13,198] | 1,267 [1,230,1,339] | 2,828 [2,798,2,979] | 6,492 [6,492,6,492] |
| UI SDK bridge (`snapshot`) | **3/3** | 2 [2,2] | 2 [2,2] | 4,701 [4,701,4,701] | 1,206 [1,169,1,228] | 2,691 [2,656,2,833] | **2,391 [2,391,2,391]** |
| UI SDK bridge (`query`) | **3/3** | 4 [4,4] | 4 [4,4] | **2,664 [2,664,2,664]** | 1,276 [1,201,1,408] | 5,760 [5,378,5,999] | 2,574 [2,574,2,574] |

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
4. **Model latency dominates.** Provider latency is ~1.2 s of roughly 2.4–2.8 s
   wall clock for the 2-turn arms. Differences in dispatch mechanics are small
   next to the model call, so this run cannot support "X ms dispatch" claims.
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
