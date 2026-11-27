// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadInvoice, computeTotals, DEFAULT_FIXTURE } from '../src/workload.mjs'
import { verifyResult, expectedState } from '../src/verdict.mjs'
import { createFixtureProvider } from '../src/providers.mjs'
import { createContractArm, createReferenceStateMachine, createStubArm } from '../src/arms.mjs'
import { runArm, runBenchmark } from '../src/harness.mjs'
import { digestFile, assertComparable, renderMarkdown, summarise } from '../src/report.mjs'
import { freshUsage, mergeUsage } from '../src/metrics.mjs'

const invoice = loadInvoice()
const prompt = readFileSync(new URL('../prompt.txt', import.meta.url), 'utf8')
const freshArm = () => createContractArm(createReferenceStateMachine(structuredClone(invoice)))

test('shared verifier rejects the uncorrected fixture and accepts exactly one correction', () => {
  const bad = verifyResult({ line_items: invoice.line_items, version: invoice.version, status: 'PENDING' }, invoice)
  assert.equal(bad.pass, false)
  assert.ok(bad.checks.some((c) => c.name === 'target_tax_rate' && !c.pass))

  const good = expectedState(invoice)
  const ok = verifyResult({ line_items: good.line_items, version: good.version, status: 'COMMITTED' }, invoice)
  assert.equal(ok.pass, true, JSON.stringify(ok.checks.filter((c) => !c.pass)))
})

test('verifier catches collateral changes and forged totals', () => {
  const expected = expectedState(invoice)
  const tampered = expected.line_items.map((i) => (i.id === 'LI-9901' ? { ...i, amount: 999 } : i))
  const result = verifyResult({ line_items: tampered, version: expected.version, status: 'COMMITTED' }, invoice)
  assert.equal(result.pass, false)
  assert.ok(result.checks.some((c) => c.name === 'no_collateral_changes' && !c.pass))
  assert.ok(result.checks.some((c) => c.name === 'total' && !c.pass))
})

test('harness accumulates only provider-reported token usage', async () => {
  const result = await runArm({
    arm: freshArm(), provider: createFixtureProvider(), prompt, invoice,
  })
  assert.equal(result.verdict.pass, true, JSON.stringify(result.trace))
  assert.equal(result.turns, 2)
  assert.equal(result.toolCalls, 2)
  assert.deepEqual(result.usage, { promptTokens: 850 + 920, completionTokens: 60 + 40 })
  assert.equal(result.stoppedBy, 'committed')
  assert.equal(result.contextChars > 0, true)
  assert.equal(Number.isFinite(result.armMechanicsMs), true)
  assert.equal(result.armMechanicsMs >= 0, true)
  assert.equal(result.trace.every((t) => Number.isFinite(t.observeMs) && Number.isFinite(t.applyMs)), true)
})

test('missing usage stays missing — never estimated', async () => {
  const fixture = createFixtureProvider()
  const noUsage = {
    name: 'test/no-usage', mode: 'measured', reportsUsage: false,
    async complete(input) {
      const response = await fixture.complete(input)
      delete response.usage
      return response
    },
  }
  const result = await runArm({ arm: freshArm(), provider: noUsage, prompt, invoice })
  assert.equal(result.verdict.pass, true)
  assert.deepEqual(result.usage, { promptTokens: null, completionTokens: null })

  let usage = freshUsage()
  usage = mergeUsage(usage, { promptTokens: 10, completionTokens: 5 })
  usage = mergeUsage(usage, undefined)
  assert.equal(usage.reported, false)
  assert.equal(usage.promptTokens, null)
})

test('self-test mode is stamped and markdown carries the warning', async () => {
  const report = await runBenchmark({
    arms: [freshArm], provider: createFixtureProvider(), prompt, invoice,
    mode: 'selftest', maxTurns: 10,
    meta: { trials: 1, pinsDigest: digestFile(new URL('../pins.json', import.meta.url)), fixtureDigest: digestFile(DEFAULT_FIXTURE) },
  })
  assert.equal(report.mode, 'selftest')
  assert.equal(report.trials[0].stub, false)
  assert.match(renderMarkdown(report), /SELF-TEST ONLY/)
  const summary = summarise(report)
  assert.equal(summary['contract:reference-contract'].passed, 1)
  assert.equal(summary['contract:reference-contract'].promptTokens.median, 1770)
})

test('comparability guard blocks selftest vs measured and pin drift', () => {
  const base = {
    mode: 'selftest', provider: 'p', pinsDigest: 'a', workload: { fixtureDigest: 'f' },
  }
  assert.doesNotThrow(() => assertComparable([base, { ...base }]))
  assert.throws(() => assertComparable([base, { ...base, mode: 'measured' }]), /mode/)
  assert.throws(() => assertComparable([base, { ...base, pinsDigest: 'b' }]), /pinsDigest/)
  assert.throws(() => assertComparable([base, { ...base, workload: { fixtureDigest: 'g' } }]), /fixture/)
})

test('stub arms fail the shared verifier instead of being silently skipped', async () => {
  const result = await runArm({
    arm: createStubArm('dom', 'not built'), provider: createFixtureProvider(), prompt, invoice,
  })
  assert.equal(result.verdict.pass, false)
  assert.equal(result.error.name, 'NotImplementedError')
  assert.equal(result.committed, false)
})

test('fixture provider drives the query-first bridge with read/act calls', async () => {
  const provider = createFixtureProvider()
  const full = await provider.complete({
    context: '[{"label":"tax-rate-LI-9914","value":"0"}]',
    contextKind: 'component-snapshot',
    armName: 'ui-sdk:agent-bridge-query',
  })
  assert.deepEqual(full.call, { tool: 'query', input: { text: 'LI-9914' } })

  const row = await provider.complete({
    context: '[{"label":"tax-rate-LI-9914","value":"0"}]',
    contextKind: 'component-query',
    armName: 'ui-sdk:agent-bridge-query',
  })
  assert.equal(row.call.tool, 'act')
  assert.equal(row.call.steps[0].action, 'setValue')

  const status = await provider.complete({
    context: '[{"label":"status","value":"PENDING"}]',
    contextKind: 'component-query',
    armName: 'ui-sdk:agent-bridge-query',
  })
  assert.equal(status.call.steps[0].action, 'press')
})

test('version fence rejects a stale write', async () => {
  const sm = createReferenceStateMachine(structuredClone(invoice))
  await assert.rejects(() => sm.updateField('LI-9914', 'tax_rate', 0.0825, invoice.version - 1), /CONCURRENCY_ERROR/)
})
