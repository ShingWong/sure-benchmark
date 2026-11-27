# sure-benchmark

**Reproducible agent-architecture benchmark for the sure stack.**

> **Status: measured — two 3-trial runs are published in [`RESULTS.md`](RESULTS.md).**
> Run 1: hosted `anthropic/claude-sonnet-4.5`. Run 2: local
> `QWEN3.8_27B_Q40`. Both record real provider token usage, latency, medians
> and min/max. `results/` also contains earlier `mode: "selftest"` files from
> a fixture provider with hardcoded token counts — those exercise the plumbing
> only and must never be quoted as measurements.

> **Released `v1.0.0` — 2026-11-27.**
> Scope: method, harness, four arms, two pinned measured runs. This is a
> reproducible result set, not a universal leaderboard. Final sign-off and
> evidence are recorded in [`RESULTS.md`](RESULTS.md).

This project asks a narrow question: for the **same** fictional billing
reconciliation task, how much context does an agent have to read and how many
actions does it need when its interface is (A) a conventional web page, (B) a
component-state bridge, or (C) a versioned contract state machine?

It exists because the sure stack is architecturally different from the setups
used in published component-bridge benchmarks. Rather than claim equivalence
we do not have, we publish the **method**, the **pins**, and the **shared
verifier**, and we state the differences plainly.

## What is measured

| Metric | Source | Honest? |
|---|---|---|
| Turns to completion | harness loop | yes |
| Tool/action calls | provider responses | yes |
| Context characters per turn | exact string handed to the provider | yes — comparable to third-party "characters read" figures |
| Wall-clock time | `performance.now()` | yes |
| Prompt / completion tokens | **provider usage report only** | `null` when absent; never estimated |
| Correctness | one shared verifier, 8 checks | yes — failed trials retained |

## What is not measured

- Nothing in `mode: "selftest"` is a measurement.
- No "dispatch latency" claim: arm mechanics and model latency are timed
  separately, but end-to-end speed is still dominated by the model.
- The cited third-party figures (§Sources) are **not** our results.

## Measured environments

| Run | Provider | Sanitized environment |
|---|---|---|
| 1 | OpenRouter, `anthropic/claude-sonnet-4.5` | hosted model; exact id and pins digest in `RESULTS.md` |
| 2 | Local llama.cpp HTTP API | dual-socket Xeon E5-2698 v4, 64 GiB RAM, one AMD Instinct MI50 32 GB (ROCm/HIP), llama.cpp `1.0.0-dev`, `Qwen3.8-27B-Q4_0` at Q4_0 / 32 K context, flash attention and speculative draft |

No internal address, hostname, filesystem path or credential is published.
The full host inventory stays in a private record; `RESULTS.md` §Run 2 has the
sanitized flags and the complete measured table. The two runs use different
models and are never compared to each other.

## Layout

```
prompt.txt                 standardized task, identical for all arms
fixtures/invoice.json      20-row fictional ledger, seeded fault LI-9914
pins.json                  exact versions + source URLs; digest stamped on every run
src/verdict.mjs            THE success criterion — one implementation for all arms
src/harness.mjs            measurement loop; no estimates, no dropped failures
src/arms.mjs               contract arm + reference state machine
src/sure-state-adapter.mjs real sure-state, version fences via versionWhere/ConflictError
arms/README.md             equivalence contract — read this before trusting a comparison
arms/dom/                  Arm A: neutral React table + Playwright ariaSnapshot driver
arms/ui-sdk/               Arm B: @ui-sdk/react@0.1.0-beta.1 bridge screen + driver
arms/ui-sdk/query-driver.mjs  Arm B2: same screen, query()-based reads (anti-strawman)
arms/server.mjs            shared HTTP API, per-session state, same version fence
providers/tool-contracts.mjs  per-arm call shapes + stop condition, shared by adapters
providers/gemini.mjs       Gemini REST, real token usage
providers/openrouter.mjs   OpenRouter Sonnet-family run
providers/llamacpp-local.mjs  local OpenAI-compatible run; address/model from env only
providers/sure-gentic.example.mjs  template for other vendors (no credentials in repo)
```

## Quick start

```bash
npm ci
npm test                       # 10 hermetic tests, no browser needed
npm run verify:pins            # manifest and installed versions must match pins.json

npm run selftest               # contract arm, fixture provider — plumbing check
node arms/server.mjs &         # 127.0.0.1:4317 only
(cd arms/dom && npm ci && npm run build)
(cd arms/ui-sdk && npm ci && npm run build)
npm run selftest -- --arm=all              # all four arms, still selftest
npm run selftest -- --arm=sure-state --adapter=sure-state   # real sure-state adapter
```

Measured runs require a real provider and never use the fixture:

```bash
export GEMINI_API_KEY=...                       # or GOOGLE_API_KEY; never commit
export BENCH_MODEL=gemini-2.5-flash-lite        # pinned in providers/gemini.mjs
npm run bench -- --mode=measured --arm=all --adapter=sure-state \
  --provider="$PWD/providers/gemini.mjs" --trials=3
```

For the Sonnet-family run comparable in shape to the published Vercel work:

```bash
export OPENROUTER_API_KEY=...                       # never commit
export BENCH_MODEL=anthropic/claude-sonnet-4.5      # pinned in pins.json
npm run bench -- --mode=measured --arm=all --adapter=sure-state \
  --provider="$PWD/providers/openrouter.mjs" --trials=3
```

Vercel did **not** name the exact Sonnet version, so this is a pinned
Sonnet-family model, not an exact-match claim. Our task is also smaller than
their settings screen, so compare our four arms to each other only.

For a local OpenAI-compatible llama.cpp server (no address or model id is
committed):

```bash
export BENCH_BASE_URL=http://<host>:<port>/v1
export BENCH_MODEL=<exact-id-from-v1-models>
npm run bench -- --mode=measured --arm=all --adapter=sure-state \
  --provider="$PWD/providers/llamacpp-local.mjs" --trials=3
```

`providers/gemini.mjs` calls Google AI Studio REST directly because
sure-gentic's `GoogleAIStudioProvider.complete()` does **not** return
`usageMetadata`; the direct adapter records real prompt/completion tokens and
per-call latency. `providers/sure-gentic.example.mjs` remains as a template for
other vendors. Both receive the arm name from the harness so each arm gets the
correct tool contract in its system prompt.

`--trials` is declared before the run and appears in the result file. Results
are written to `results/<mode>-<timestamp>.json` and `.md`.

## Reproducibility rules

1. **Exact pins only.** No carets, ranges or floating tags. `npm ci` with the
   committed lockfiles. `npm run verify:pins` fails on drift.
2. **Pins digest in every result.** `assertComparable()` refuses to compare
   runs with different providers, modes, pins digests or fixtures.
3. **Trials, medians and spread.** The report shows median `[min, max]`; a
   single run is never presented as a benchmark.
4. **Shared verifier.** No arm defines its own success. Expected totals are
   computed from the original fixture plus the one authorised correction, so a
   wrong state cannot pass by recalculating its own totals.
5. **Failed trials stay in the file.** With their error and failing checks.
6. **No hidden post-processing.** The exact context string per turn is recorded
   as `contextChars`; the provider response call is recorded in the trace.

## Fairness notes — the asymmetries we disclose

- Arm C's fence is enforced in a server-authoritative `sure-state` store;
  `createEntityStore({ versioning: true })` supplies the expected version, so
  an agent cannot forge or race it. Arms A and B enforce the **same**
  `expectedVersion === currentVersion` rule in the shared HTTP API. The
  *mechanism* is equivalent; the *guarantee* is not identical, and we say so.
- Arm A is a conventional React page, not a Next.js/shadcn app. We are
  measuring the agent interface, not a component library shootout. Vercel's
  published benchmark used different component libraries in its browser arm;
  we do not reproduce that comparison.
- Arm B's screen is assembled from UI SDK behaviors. Its `snapshot()` lists
  only UI SDK components — we expose status as a UI SDK field so the final
  assertion reads the bridge, not a hidden DOM value.
- **Arm B2 uses `query()` for targeted reads** after one orienting snapshot.
  This is the bridge's own recommended tool and is included so we do not
  compare against a deliberately wasteful bridge.
- **Schema honesty was tested, not asserted.** The first local run failed Arm B
  because the bridge snapshot exposed control values but not the `taxable`
  domain fact, so the agent "fixed" two legitimate non-taxable zero rows. The
  contract arm's typed state exposed `taxable` directly. This is a structural
  class of bug — any presentation-derived context requires the app to mirror
  domain facts manually — and the independent beta.1 testing found related
  agent/app disagreements. See `RESULTS.md` § "Schema honesty" for the trace,
  the mechanism, and the required caveats.
- Provider latency (the model call only) is recorded separately from wall
  clock (which includes browser setup). They are different numbers.
- Arm C has no presentation layer. That is the independent variable.
- Third-party figures are **characters read**, not tokens. We keep both
  columns, labelled, and never convert between them.

## Sources

Quoted as context only; none of these numbers are produced by this project.

### Primary — Vercel Labs, 2026-11-12
- "Introducing UI SDK: 50+ Interface Behaviors for AI Coding Agents" —
  <https://github.com/vercel-labs/ui/blob/main/apps/docs/content/docs/core/changelog/introducing-ui-sdk.mdx>
- "Built for Agents: The Agent Bridge Benchmark" — <https://ui-sdk.dev/docs/agents>
- Repository: <https://github.com/vercel-labs/ui>
- `@ui-sdk/core` / `@ui-sdk/react` `0.1.0-beta.1`, Apache-2.0. Launch-day
  figures: 16 → 5 tool calls, 39.8k → 6.8k characters, 41 s → 16 s,
  $0.073 → $0.032; medians of 3 runs, one settings task, Sonnet via Claude
  Code. Vercel labels them directional; live docs show newer figures.

### Secondary — MarkTechPost, 2026-11-13
- Michal Sutter, "Vercel Releases UI SDK: 50+ UI Behaviors for AI Coding Agents" —
  <https://www.marktechpost.com/2026/11/13/vercel-ui-sdk-agent-ui-behaviors/>
- Reports the 69% tool-call and 83% characters-read reductions with caveats:
  one task, three runs, unnamed Sonnet version, different component library.

### Independent — Kartikay Dhar, 2026-11-12
- "Vercel UI SDK tested: allow, confirm and secret checks" —
  <https://www.kartikaydhar.com/blog/vercel-ui-sdk-agent-bridge-tested>
- Same 5 vs 16 differential on beta.1 in jsdom. Found a cancelled change can
  still report success, and an undeclared action name may be accepted — the
  Arm B driver therefore re-reads values instead of trusting `act()`.

The full design document is in the private `sure-master` repo:
`ui_sdk_vs_sure_stack.md` (sections 7–8).

## Release checklist — satisfied

- [x] Two measured runs, 3 trials per arm, with pinned model ids and configured keys.
- [x] Medians with min/max in `RESULTS.md`; single-trial runs are labelled smoke tests and are not quoted.
- [x] Provider name, model and pins digest recorded in each result file and in `RESULTS.md`.
- [x] `arms/README.md` reviewed against both result tables; asymmetries and the failed 0/3 attempt are disclosed.
- [x] Fixture, prompt and pins held constant **within each compared run**; `assertComparable()` refuses to mix runs with different providers, modes, fixtures or pins digests. The two published runs use different models and are never compared to each other.

The project publishes a **method and a measured result set** for evaluating
agentic interfaces against deterministic state contracts — not a universal
leaderboard. Compare arms within a run, not across runs or against figures
from other workloads.

## License

Dual-licensed **AGPL-3.0-or-later OR LicenseRef-Commercial** — Project lextelligent.
All data is fictional; no secrets, credentials, PHI or real hosts are included.
