# Arms — equivalence contract

This directory defines how the three arms stay **apple-to-apple**. Critics
should be able to audit this file and the shared verifier
(`../src/verdict.mjs`) without trusting any README claim.

## What is identical across arms

| Property | Source of truth |
|---|---|
| Workload | `../fixtures/invoice.json` (20 rows, seeded fault LI-9914) |
| Prompt | `../prompt.txt` |
| Success check | `../src/verdict.mjs` — 8 checks, one implementation, no arm-specific override |
| Version fence | `expectedVersion === currentVersion`; one mutation, so version must go 104 → 105 |
| Final state shape | `{ line_items, version, status }` from each arm's `result()` |
| Metric collection | `../src/harness.mjs` — turns, tool calls, context chars, provider-reported tokens, wall clock |
| Provider | injected; no provider is baked into an arm |

A trial counts as correct **only** if all 8 shared checks pass. Failed trials
are kept in the result file with their error and verdict details.

## What is deliberately *not* identical (disclosed)

- **Arm C** enforces the fence in a server-authoritative `sure-state` adapter
  using `versionWhere` / `ConflictError`. The agent cannot forge a version:
  `createEntityStore({ versioning: true })` supplies it from its own snapshot.
- **Arms A and B** use the shared HTTP API in `server.mjs`, which enforces the
  same `expectedVersion` rule server-side. Their *agent surfaces* differ
  (selectors + aria snapshot vs component snapshot + `act`), which is the thing
  being measured.
- The presentation differs: Arm A is a conventional React table, Arm B is a
  UI SDK component screen, Arm C has no presentation layer. This is the
  independent variable, not a hidden advantage.
- The cited third-party figures are **characters read**, not tokens. We record
  `contextChars` for directional comparison and keep token columns separate.

## Layout

```
arms/
  server.mjs        shared HTTP API + static host, per-session state, version fence
  dom/              Arm A: neutral React + Vite page, Playwright driver
  ui-sdk/           Arm B: @ui-sdk/react@0.1.0-beta.1 screen, bridge driver
  ui-sdk/query-driver.mjs   Arm B2: same screen, agent uses query() instead of full snapshots
```

**Arm B2 exists so the bridge comparison is not a strawman.** Its agent orients
once with `snapshot()`, then reads individual components with `query()` and
mutates through `act()`. It uses the same screen, fixture, prompt and verifier
as Arm B; only the read strategy differs. Compare all four arms in the same
measured run, never B against B2 across runs.

## Build and run

```bash
# from repository root — exact pins, commit both lockfiles
npm ci
(cd arms/dom    && npm ci && npm run build)
(cd arms/ui-sdk && npm ci && npm run build)
npx playwright install chromium

node arms/server.mjs &            # http://127.0.0.1:4317

# measured runs require a real provider module; see ../README.md
npm run bench -- --mode=measured --arm=all --adapter=sure-state \
  --provider=/absolute/path/to/my-provider.mjs --trials=3
```

The server binds to `127.0.0.1` only. No secret, credential, PHI or real host
appears in any arm.

## Driver contract

Each driver exports `createDomArm()` / `createUiSdkArm()` returning the same
interface as `src/arms.mjs`:

```js
{
  name,
  async observe() -> { context, contextKind },
  async apply(call),
  async status() -> 'PENDING' | 'COMMITTED',
  async result() -> { line_items, version, status },
  async dispose()
}
```

`observe()` produces exactly the payload the agent sees. Nothing is filtered
after the fact: the recorded `contextChars` is the length of that payload.
