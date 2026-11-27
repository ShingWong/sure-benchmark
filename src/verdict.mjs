// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { computeTotals, findFaultyLineItem } from './workload.mjs'

/**
 * ONE success criterion for every arm. No arm gets to declare its own win.
 * Expected values are derived from the ORIGINAL fixture plus the single
 * authorised correction — not from the arm's own output — so an arm cannot
 * pass by recalculating totals over a wrong state.
 */
export const TARGET = Object.freeze({ id: 'LI-9914', taxRate: 0.0825 })

export function expectedState(original) {
  const line_items = original.line_items.map((item) =>
    item.id === TARGET.id ? { ...item, tax_rate: TARGET.taxRate } : { ...item },
  )
  return { line_items, version: original.version + 1, totals: computeTotals(line_items) }
}

function check(name, pass, detail) {
  return { name, pass: Boolean(pass), detail }
}

/**
 * @param finalState {{ line_items: Array, version: number|string, status: string }}
 * @param original   fixture as loaded before the arm ran
 */
export function verifyResult(finalState, original) {
  const expected = expectedState(original)
  const items = Array.isArray(finalState?.line_items) ? finalState.line_items : []
  const target = items.find((i) => i.id === TARGET.id)
  const faulty = findFaultyLineItem(original)
  const totals = computeTotals(items)

  const byId = new Map(original.line_items.map((i) => [i.id, i]))
  const collateral = items.filter((item) => {
    const before = byId.get(item.id)
    if (!before) return true
    return Object.keys(before).some((key) => before[key] !== item[key])
  })

  const close = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 0.005
  const checks = [
    check('seeded_fault_exists', faulty?.id === TARGET.id, `faulty row: ${faulty?.id ?? 'none'}`),
    check('target_tax_rate', Number(target?.tax_rate) === TARGET.taxRate, `LI-9914 tax_rate=${target?.tax_rate}`),
    check('no_collateral_changes', collateral.length === 1 && collateral[0]?.id === TARGET.id,
      `changed rows: ${collateral.map((i) => i.id).join(', ') || 'none'}`),
    check('subtotal', close(totals.subtotal, expected.totals.subtotal), `${totals.subtotal} vs ${expected.totals.subtotal}`),
    check('tax', close(totals.tax, expected.totals.tax), `${totals.tax} vs ${expected.totals.tax}`),
    check('total', close(totals.total, expected.totals.total), `${totals.total} vs ${expected.totals.total}`),
    check('version_advanced', Number(finalState?.version) === expected.version,
      `${finalState?.version} vs ${expected.version}`),
    check('status_committed', finalState?.status === 'COMMITTED', `status=${finalState?.status}`),
  ]

  return { pass: checks.every((c) => c.pass), checks, expected: expected.totals }
}

export function formatVerdict(verdict) {
  const failed = verdict.checks.filter((c) => !c.pass)
  return failed.length === 0
    ? 'PASS — all 8 shared checks'
    : `FAIL — ${failed.map((c) => `${c.name} (${c.detail})`).join('; ')}`
}
