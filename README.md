# sure-benchmark

**Reproducible agent-architecture benchmark for the sure stack.**

> **Status: scaffold with passing self-tests — no published results.**
> All numbers currently in `results/` come from a fixture provider with
> hardcoded token counts. They exercise the plumbing only. They are stamped
> `mode: "selftest"` and must never be quoted as measurements.

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
- No latency number is attributed to "dispatch" or "LLM" separately unless a
  provider records it; the harness reports whole-arm wall clock only.
- The cited third-party figures (§Sources) are **not** our results.

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
arms/server.mjs            shared HTTP API, per-session state, same version fence
providers/                 measured-provider template (no credentials in repo)
```

## Quick start

```bash
npm ci
npm test                       # 8 hermetic tests, no browser needed
npm run verify:pins            # manifest and installed versions must match pins.json

npm run selftest               # contract arm, fixture provider — plumbing check
node arms/server.mjs &         # 127.0.0.1:4317 only
(cd arms/dom && npm ci && npm run build)
(cd arms/ui-sdk && npm ci && npm run build)
npm run selftest -- --arm=all              # all three arms, still selftest
npm run selftest -- --arm=sure-state --adapter=sure-state   # real sure-state adapter
```

A measured run needs a real provider:

```bash
cp providers/sure-gentic.example.mjs providers/my-provider.mjs
# pin BENCH_MODEL, set one provider key, adapt the response parser
npm run bench -- --mode=measured --arm=all --adapter=sure-state \
  --provider="$PWD/providers/my-provider.mjs" --trials=3
```

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

## Before publishing anything

- [ ] Add ≥N measured runs per arm with a pinned model id and a configured key.
- [ ] Confirm medians and spread; do not quote single trials.
- [ ] Record the provider version and model in each result file.
- [ ] Review `arms/README.md` against the final result table.
- [ ] Keep the fixture, prompt and pins unchanged between compared runs.

## License

Dual-licensed **AGPL-3.0-or-later OR LicenseRef-Commercial** — Project lextelligent.
All data is fictional; no secrets, credentials, PHI or real hosts are included.
