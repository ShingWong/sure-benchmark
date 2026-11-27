// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { TARGET } from './verdict.mjs'

/**
 * FIXTURE PROVIDER — SELF-TEST ONLY.
 *
 * Every usage number and tool call below is a hardcoded constant. It exists to
 * prove the harness accumulates metrics correctly. It measures nothing about
 * architecture efficiency. Results produced with it are stamped mode=selftest
 * and must never be compared with measured runs.
 */
export function createFixtureProvider() {
  return {
    name: 'fixture/deterministic-v1',
    mode: 'selftest',
    reportsUsage: true,
    async complete({ context, contextKind }) {
      const applied = correctionApplied(context, contextKind)
      if (contextKind === 'contract-state') {
        return applied
          ? { usage: { promptTokens: 920, completionTokens: 40 }, call: { name: 'submit', args: {} } }
          : {
              usage: { promptTokens: 850, completionTokens: 60 },
              call: { name: 'updateTaxRate', args: { id: TARGET.id, tax_rate: TARGET.taxRate } },
            }
      }
      if (contextKind === 'aria-snapshot') {
        return applied
          ? { usage: { promptTokens: 28600, completionTokens: 95 }, call: { type: 'click', selector: '#submit-btn' } }
          : {
              usage: { promptTokens: 14200, completionTokens: 180 },
              call: { type: 'fill', selector: `[aria-label="tax-rate-${TARGET.id}"]`, value: '0.0825' },
            }
      }
      if (contextKind === 'component-snapshot') {
        return applied
          ? {
              usage: { promptTokens: 4100, completionTokens: 65 },
              call: { steps: [{ ref: 'Submit reconciliation', action: 'press' }], intent: 'submit' },
            }
          : {
              usage: { promptTokens: 3800, completionTokens: 120 },
              call: {
                steps: [{ ref: `tax-rate-${TARGET.id}`, action: 'setValue', args: ['0.0825'] }],
                intent: 'update',
              },
            }
      }
      throw new Error(`fixture provider has no scripted response for ${contextKind}`)
    },
  }
}

function correctionApplied(context, kind) {
  if (kind === 'contract-state') {
    try {
      const state = JSON.parse(context)
      return Number(state.line_items?.find((i) => i.id === TARGET.id)?.tax_rate) === TARGET.taxRate
    } catch {
      return false
    }
  }
  if (kind === 'component-snapshot') {
    try {
      const snap = JSON.parse(context)
      const component = snap.find((c) => c.label === `tax-rate-${TARGET.id}`)
      return Number(component?.value) === TARGET.taxRate
    } catch {
      return false
    }
  }
  if (kind === 'aria-snapshot') {
    const at = context.indexOf(`row "${TARGET.id}`)
    if (at === -1) return false
    const rest = context.slice(at)
    const match = /\n\s*- row /.exec(rest.slice(1))
    const nextRow = match ? match.index + 1 : -1
    const block = nextRow === -1 ? rest : rest.slice(0, nextRow)
    return /0\.0825/.test(block)
  }
  return false
}

/**
 * Load a real provider adapter for measured runs. The module must export
 * `createProvider()` returning { name, mode:'measured', reportsUsage, complete }.
 * No credentials or model choices are baked into this repository.
 */
export async function loadProvider(spec) {
  const mod = await import(spec)
  if (typeof mod.createProvider !== 'function') {
    throw new Error(`Provider module ${spec} must export createProvider()`)
  }
  const provider = mod.createProvider()
  if (provider.mode !== 'measured') {
    throw new Error(`Measured runs require mode='measured', got ${provider.mode}`)
  }
  return provider
}
