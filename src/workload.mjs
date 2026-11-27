// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const DEFAULT_FIXTURE = new URL('../fixtures/invoice.json', import.meta.url)

/** Load the fictional reconciliation fixture and fail loudly on drift. */
export function loadInvoice(path = DEFAULT_FIXTURE) {
  const text = readFileSync(path, 'utf8')
  const data = JSON.parse(text)
  if (data.schemaVersion !== 1) throw new Error('Unsupported fixture schemaVersion')
  if (data.fixture !== true) throw new Error('Fixture must be marked fixture: true')
  if (!Array.isArray(data.line_items) || data.line_items.length !== 20) {
    throw new Error('Fixture must contain exactly 20 line items')
  }
  for (const key of ['invoice_id', 'customer_id', 'version', 'currency']) {
    if (data[key] === undefined) throw new Error(`Fixture missing ${key}`)
  }
  return data
}

export function fixtureDigest(path = DEFAULT_FIXTURE) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** The one seeded fault. Taxable row with no tax. */
export function findFaultyLineItem(invoice) {
  return (
    invoice.line_items.find(
      (item) => item.taxable === true && (!Number.isFinite(item.tax_rate) || item.tax_rate === 0),
    ) ?? null
  )
}

export function computeTotals(items) {
  const subtotal = items.reduce((acc, i) => acc + i.amount, 0)
  const tax = items.reduce((acc, i) => acc + (i.taxable ? i.amount * i.tax_rate : 0), 0)
  const round = (n) => Math.round(n * 100) / 100
  return { subtotal: round(subtotal), tax: round(tax), total: round(subtotal + tax) }
}

export function cloneInvoice(invoice) {
  return structuredClone(invoice)
}
