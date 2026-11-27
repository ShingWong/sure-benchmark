// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { elapsedMs, freshUsage, mergeUsage, publicUsage } from './metrics.mjs'
import { verifyResult } from './verdict.mjs'

/**
 * Run one arm. Every number here comes from an observation or the provider;
 * nothing is inferred. A failed run is kept and graded, never dropped.
 */
export async function runArm({ arm, provider, prompt, invoice, maxTurns = 10 }) {
  const started = performance.now()
  const trace = []
  let usage = freshUsage()
  let toolCalls = 0
  let turns = 0
  let stoppedBy = 'max-turns'
  let error = null
  let finalState = { line_items: [], version: 0, status: 'PENDING' }

  try {
    for (; turns < maxTurns; turns++) {
      const observation = await arm.observe()
      const context = observation.context ?? ''
      const response = await provider.complete({
        prompt,
        context,
        contextKind: observation.contextKind,
      })
      usage = mergeUsage(usage, response?.usage)
      const call = response?.call ?? null
      if (call) toolCalls += 1
      trace.push({
        turn: turns + 1,
        contextKind: observation.contextKind,
        contextChars: context.length,
        call,
      })
      if (call) await arm.apply(call)
      if ((await arm.status()) === 'COMMITTED') {
        turns += 1
        stoppedBy = 'committed'
        break
      }
    }
  } catch (err) {
    error = { name: err?.name ?? 'Error', message: err?.message ?? String(err) }
    stoppedBy = 'error'
  }

  try {
    finalState = (await arm.result()) ?? finalState
  } catch (err) {
    error ??= { name: err?.name ?? 'Error', message: `result(): ${err?.message ?? String(err)}` }
  }

  return {
    arm: arm.name,
    stub: Boolean(arm.stub),
    committed: finalState.status === 'COMMITTED',
    verdict: verifyResult(finalState, invoice),
    turns,
    toolCalls,
    contextChars: trace.reduce((sum, t) => sum + t.contextChars, 0),
    usage: publicUsage(usage),
    durationMs: elapsedMs(started),
    stoppedBy,
    error,
    trace,
  }
}

/** Run several trials of every arm against fresh state each time. */
export async function runBenchmark({ arms, provider, prompt, invoice, mode, maxTurns = 10, meta = {} }) {
  const trials = []
  for (let i = 0; i < meta.trials; i++) {
    for (const makeArm of arms) {
      const arm = await makeArm()
      try {
        trials.push({
          trial: i + 1,
          ...(await runArm({ arm, provider, prompt, invoice, maxTurns })),
        })
      } finally {
        if (typeof arm.dispose === 'function') {
          try { await arm.dispose() } catch { /* disposal must not erase a result */ }
        }
      }
    }
  }
  return {
    schemaVersion: 1,
    mode,
    provider: provider.name,
    providerMode: provider.mode,
    generatedAt: new Date().toISOString(),
    workload: { invoice_id: invoice.invoice_id, version: invoice.version, fixtureDigest: meta.fixtureDigest },
    pinsDigest: meta.pinsDigest,
    trialsDeclared: meta.trials,
    trials,
  }
}
