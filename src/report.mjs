// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export function digestFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const spread = (xs) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : [null, null])

/** Median [min, max] per arm. Token fields are null when the provider did not report them. */
export function summarise(report) {
  const groups = new Map()
  for (const t of report.trials) {
    if (!groups.has(t.arm)) groups.set(t.arm, [])
    groups.get(t.arm).push(t)
  }
  const out = {}
  for (const [arm, rows] of groups) {
    const nums = (key) => rows.map((r) => r[key]).filter((n) => Number.isFinite(n))
    const tokens = rows.every((r) => r.usage?.promptTokens != null)
      ? rows.map((r) => r.usage.promptTokens).filter((n) => Number.isFinite(n))
      : []
    out[arm] = {
      trials: rows.length,
      passed: rows.filter((r) => r.verdict.pass && !r.stub).length,
      turns: { median: median(nums('turns')), range: spread(nums('turns')) },
      toolCalls: { median: median(nums('toolCalls')), range: spread(nums('toolCalls')) },
      contextChars: { median: median(nums('contextChars')), range: spread(nums('contextChars')) },
      durationMs: { median: median(nums('durationMs')), range: spread(nums('durationMs')) },
      providerLatencyMs: {
        median: median(nums('providerLatencyMs')),
        range: spread(nums('providerLatencyMs')),
      },
      armMechanicsMs: {
        median: median(nums('armMechanicsMs')),
        range: spread(nums('armMechanicsMs')),
      },
      promptTokens: tokens.length
        ? { median: median(tokens), range: spread(tokens) }
        : { median: null, range: [null, null] },
      errors: rows.filter((r) => r.error).length,
    }
  }
  return out
}

/**
 * Refuse to compare runs that differ in provider, mode, pins or workload.
 * This is what stops a self-test number leaking into a published table.
 */
export function assertComparable(reports) {
  if (reports.length < 2) return
  const keys = ['mode', 'provider', 'pinsDigest']
  for (const key of keys) {
    const values = new Set(reports.map((r) => r[key]))
    if (values.size > 1) {
      throw new Error(`Cannot compare runs with different ${key}: ${[...values].join(' vs ')}`)
    }
  }
  const digests = new Set(reports.map((r) => r.workload.fixtureDigest))
  if (digests.size > 1) throw new Error('Cannot compare runs with different fixtures')
}

export function renderMarkdown(report, summary = summarise(report)) {
  const lines = []
  if (report.mode === 'selftest') {
    lines.push('> **SELF-TEST ONLY — fixture provider with hardcoded token counts.**')
    lines.push('> These numbers are not measurements. Do not publish or compare them.')
  }
  lines.push(`# sure-benchmark — ${report.mode}`)
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Provider: \`${report.provider}\` (${report.providerMode})`)
  lines.push(`- Workload: ${report.workload.invoice_id}, fixture sha256 \`${report.workload.fixtureDigest?.slice(0, 12)}\``)
  lines.push(`- Pins sha256: \`${report.pinsDigest?.slice(0, 12)}\``)
  lines.push(`- Trials declared per arm: ${report.trialsDeclared}`)
  lines.push('')
  lines.push('| Arm | Correct | Turns | Tool calls | Context chars | Model ms/turn | Arm mechanics ms | Wall ms | Prompt tokens | Errors |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|')
  for (const [arm, s] of Object.entries(summary)) {
    const fmt = (v) => v.median == null ? 'not reported' : `${v.median} [${v.range[0]},${v.range[1]}]`
    lines.push(
      `| ${arm} | ${s.passed}/${s.trials} | ${fmt(s.turns)} | ${fmt(s.toolCalls)} | ${fmt(s.contextChars)} | ${fmt(s.providerLatencyMs)} | ${fmt(s.armMechanicsMs)} | ${fmt(s.durationMs)} | ${fmt(s.promptTokens)} | ${s.errors} |`,
    )
  }
  lines.push('')
  lines.push('## Fairness notes')
  lines.push('')
  lines.push('- All arms use the same fixture, prompt, shared verifier and seeded fault.')
  lines.push('- Arm C enforces the version fence **server-side**; Arms A/B enforce the equivalent rule in app code. This asymmetry is deliberate and disclosed, not hidden.')
  lines.push('- `not reported` means the provider did not report a value. No value was estimated.')
  lines.push('- Model ms/turn is measured around the provider call only. Arm mechanics ms is timed directly around observe()/apply() — it is NOT wall minus model.')
  lines.push('- Wall clock includes model calls, arm mechanics, browser setup and harness overhead. Model time dominates it; compare arms on arm mechanics when the question is interface cost.')
  lines.push('- Context characters are recorded for comparability with third-party figures quoted in the design document; they are not tokens.')
  lines.push('- A trial counts as correct only if every shared check passes. Failed trials are retained and counted.')
  return lines.join('\n') + '\n'
}
