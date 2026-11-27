# Measured results — 2026-11-27

> **Scope:** one fictional task, four arms, 3 trials each, two separate pinned
> models. These are real provider-reported measurements, but they are **not** a
> general benchmark and must not be compared with figures from other workloads.
> Run 1 (Sonnet) and Run 2 (local Qwen) use different models — compare arms
> **within** a run, never across runs.

## Run 1 — hosted Sonnet

### Run identity

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

---

## Run 2 — local Qwen3.8-27B-Q4_0

### Run identity

| Field | Value |
|---|---|
| Provider | `llamacpp:Qwen3.8-27B-Q4_0.gguf` (OpenAI-compatible local server) |
| Model pin | `QWEN3.8_27B_Q40`; exact server id supplied by `BENCH_MODEL` at run time |
| Address | supplied by `BENCH_BASE_URL` at run time — **not stored in this repo** |
| Pins SHA-256 | `2b018097df26…` |
| Prompt / fixture / verifier | identical to Run 1 |
| Trials declared | 3 per arm |
| Raw result | `results/measured-2026-11-27T08-08-24-118Z.json` (local; gitignored) |

### Results (median [min, max] over 3 trials)

| Arm | Correct | Turns | Context chars | Model ms/turn | Arm mechanics ms | Wall ms | Prompt tokens |
|---|---:|---:|---:|---:|---:|---:|---:|
| Contract (`sure-state`) | **3/3** | 2 | 4,843 | 1,207 [1,143,1,288] | **0.65 [0.38, 1.68]** | **2,417 [2,297,2,579]** | 2,571 |
| DOM / aria snapshot | **3/3** | 2 | 13,198 | 9,819 [7,773,10,294] | 272.49 [258.10,310.49] | 19,918 [15,887,20,884] | 6,756 |
| UI SDK bridge (`snapshot`) | **3/3** | 2 | 8,945 | 8,632 [7,256,8,761] | 260.80 [224.86,272.50] | 17,542 [14,839,17,844] | 3,699 |
| UI SDK bridge (`query`) | **3/3** | 6 | 5,212 | 1,367 [1,343,1,375] | 352.04 [350.81,356.69] | 9,152 [8,950,16,033] | 4,369 |

### What changed versus Run 1

- **End-to-end latency now follows context size.** The local model's prompt
  evaluation cost scales with the payload: the contract arm's ~1.2 s model
  turn (4,843 chars) versus ~8–10 s for DOM (13,198 chars) and the bridge
  (8,945 chars). That makes the contract arm **~7–8× faster in wall clock**
  than either browser arm — an advantage the hosted model's flat ~1.2 s/turn
  had masked.
- **On tokens the contract arm did beat the bridge here (2,571 vs 3,699),
  unlike Run 1** — but the gap comes mostly from the extra `taxable-<id>`
  fields we had to expose on the bridge screen (8,945 chars) after the first
  local attempt misread non-taxable rows. That screen change is disclosed; it
  was needed for a fair task, so do not present the token gap as intrinsic.
- **The `query()` bridge regressed on this model:** 6 turns, 5,212 chars,
  4,369 tokens, 9,152 ms — worse than the plain bridge on every total metric.
  A targeted read strategy is not automatically cheaper.
- **Arm mechanics stayed ~0.65 ms vs ~260–272 ms** for the browser arms, same
  as Run 1 — about 400× less interface work.
- **First attempt failed honestly:** the local model changed two non-taxable
  rows because the bridge snapshot did not expose `taxable`. Those 0/3 trials
  are retained in `results/`; the screen and tool contract were then fixed and
  the whole set rerun.

### Schema honesty: the `taxable` failure

The first local run (retained at
`results/measured-2026-11-27T08-03-45-634Z.json`) failed Arm B 0/3. Its trace
shows the model treating every zero tax rate as the seeded fault:

```
LI-9914  tax_rate 0.0825   ← intended correction
LI-9906  tax_rate 0.0825   ← non-taxable, legitimate zero
LI-9916  tax_rate 0.0825   ← non-taxable, legitimate zero
```

The shared verifier caught it: `no_collateral_changes` failed (three rows
changed instead of one) and `version_advanced` failed (107 vs 105). The
contract arm did not make this mistake: its context is the typed entity state,
where every row carries `taxable: true|false` alongside `tax_rate`. The
component bridge's `snapshot()` listed labels, values and actions — control
state — but the fact needed to disambiguate the task, `taxable`, existed only
in the app and was not in the agent's context. The agent therefore reasoned
from a presentation heuristic ("zero means broken") instead of the domain
schema.

We fixed the screen by adding `taxable-<id>` fields to the bridge, disclosed
that change, and reran. That is itself the point: **a component bridge can
carry the fact, but only if the app author remembers to surface it; a contract
state machine exposes the typed domain model by construction.** This is a
schema-honesty advantage — the agent sees what the data *is*, not what the UI
happens to render — and it showed up as a correctness failure, not a token
difference.

### Why this is a class of bug, not a one-off

The mechanism generalises. A component bridge hands the agent a
**presentation-derived projection** — labels, values, actions, row text. Any
domain fact the app does not explicitly mirror into that projection is
invisible to the agent, even though the app itself knows it. The agent then
reconstructs the missing fact from a superficial signal; here, "zero tax rate
means faulty." The same shape of failure appears in the independent beta.1
testing cited in §Sources: a cancelled change still returned success, and an
action name accepted by `act()` was absent from `snapshot()`. Those are also
agent/app disagreements caused by a projection that does not carry the full
contract.

`sure-state` removes this class **inside the contract surface** by construction:
the agent reads typed entity state from the authoritative store, including
`taxable`, `tax_rate` and `version`. There is no second presentation-layer
schema for an app author to keep in sync, and version fences prevent acting on
a stale projection. This is a structural win, not a lucky correct answer.

**Caveats, required when quoting this:** we did not survey other projects, so
we do not claim a frequency ("almost every project"). We claim a mechanism,
one directly observed instance, and independent corroboration of related
agent/app disagreements. A bridge *can* surface the same facts if the app
chooses to. The contract surface can still be misread or be badly designed —
it eliminates this *class* of omission bug, not all agent errors. One model,
one task, three trials; no general accuracy claim.

### Limits

Different model family and a local server, so **no cross-run comparison with
Run 1**. No internal host, path or credential is committed; the address and
model id live only in environment variables. Medians over 3 trials only.
