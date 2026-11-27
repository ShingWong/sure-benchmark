# Changelog

## 1.0.0 (2026-11-27)

First release candidate. Contains the complete reproducible benchmark, not a
universal leaderboard.

- Standardized fictional workload (`CUST-8842`, 20 line items, seeded fault
  LI-9914), prompt and one shared 8-check verifier for every arm.
- Framework-free harness with direct measurements: turns, tool calls, context
  characters, provider-reported tokens, model latency and arm mechanics.
  Missing usage stays `null` and failed trials are retained.
- Four arms: `contract:sure-state`, `dom:react-aria-snapshot`,
  `ui-sdk:agent-bridge`, `ui-sdk:agent-bridge-query` (targeted `query()` reads,
  included so the bridge comparison is not a strawman).
- Exact-version pins in `pins.json` and three committed lockfiles; pins digest
  stamped into every result. `assertComparable()` blocks mixed runs.
- Three real providers: Gemini REST, OpenRouter and local llama.cpp — all with
  real token usage and latency. No credential or internal host is committed.
- Two 3-trial measured runs documented in `RESULTS.md`: hosted
  `anthropic/claude-sonnet-4.5` and local `QWEN3.8_27B_Q40`, with medians and
  min/max, the retained 0/3 local failure and the schema-honesty analysis.
- 10 hermetic tests; `npm run verify:pins`; CI and pinned central security gate.

Sign-off for the `v1.0.0` tag is tracked at the end of `RESULTS.md`.
