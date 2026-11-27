// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

// Arm A: a conventional React page with an ordinary HTML table and inputs.
// No sure-stack UI is used here — this is the browser-automation baseline.

import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const qs = new URLSearchParams(location.search)
let session = qs.get('session')

async function getState() {
  const res = await fetch(`/api/invoice?session=${encodeURIComponent(session)}`)
  if (!res.ok) throw new Error(`invoice fetch failed: ${res.status}`)
  return res.json()
}

if (!session) {
  const res = await fetch('/api/session')
  const { session: id } = await res.json()
  session = id
  history.replaceState(null, '', `?session=${encodeURIComponent(session)}`)
}

function App() {
  const [state, setState] = useState(null)

  useEffect(() => { getState().then(setState) }, [])

  async function changeTax(id, raw) {
    const value = Number(raw)
    const res = await fetch('/api/update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, id, field: 'tax_rate', value, version: state.version }),
    })
    if (res.ok) setState(await getState())
    else setState(await getState()) // surface the server's version on next turn
  }

  async function submit() {
    const res = await fetch('/api/commit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, version: state.version }),
    })
    setState(await getState())
    if (!res.ok) console.warn('commit rejected by version fence')
  }

  // The driver reads only this payload; it is the arm's final state.
  window.__bench = { getState: () => state }

  if (!state) return <div id="reconciliation-root">loading</div>
  const subtotal = state.line_items.reduce((a, i) => a + i.amount, 0)
  const tax = state.line_items.reduce((a, i) => a + (i.taxable ? i.amount * i.tax_rate : 0), 0)

  return (
    <div id="reconciliation-root">
      <h1>Reconciliation: {state.customer_id}</h1>
      <table id="ledger-table">
        <thead><tr><th>ID</th><th>Description</th><th>Amount</th><th>Taxable</th><th>Tax Rate</th></tr></thead>
        <tbody>
          {state.line_items.map((row) => (
            <tr key={row.id} data-row-id={row.id}>
              <td>{row.id}</td><td>{row.description}</td>
              <td>${row.amount.toFixed(2)}</td><td>{row.taxable ? 'TRUE' : 'FALSE'}</td>
              <td>
                <span className="tax-rate-value" aria-label={`tax-rate-value-${row.id}`}>
                  {row.tax_rate}
                </span>
                <input type="number" step="0.0001" value={row.tax_rate}
                  aria-label={`tax-rate-${row.id}`}
                  onChange={(e) => changeTax(row.id, e.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>Subtotal: ${subtotal.toFixed(2)} | Tax: ${tax.toFixed(2)} | Total: ${(subtotal + tax).toFixed(2)}</div>
      <button id="submit-btn" onClick={submit}>Submit Reconciliation</button>
      <div id="status-indicator">{state.status}</div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
