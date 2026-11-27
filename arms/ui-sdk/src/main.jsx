// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

// Arm B: the same task assembled from @ui-sdk/react beta.1 components.
// The bridge is created BEFORE render, as required by the verified API.

import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createAgent } from '@ui-sdk/react/agent'
import { Field, FieldLabel, FieldControl } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Button } from '@ui-sdk/react/button'

export const agent = createAgent({
  allow: (step) => step.action !== 'press' || step.label !== 'Delete project',
})

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
    const res = await fetch('/api/update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, id, field: 'tax_rate', value: Number(raw), version: state.version }),
    })
    setState(await getState())
    if (!res.ok) console.warn('update rejected by version fence')
  }

  async function submit() {
    const res = await fetch('/api/commit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, version: state.version }),
    })
    setState(await getState())
    if (!res.ok) console.warn('commit rejected by version fence')
  }

  window.__bench = { agent, getState: () => state }

  if (!state) return <div>loading</div>

  return (
    <div id="reconciliation-root">
      <h1>Reconciliation: {state.customer_id}</h1>
      {state.line_items.map((item) => (
        <Field key={item.id} name={`tax-${item.id}`}>
          <FieldLabel>{`tax-rate-${item.id}`}</FieldLabel>
          <FieldControl render={
            <Input value={String(item.tax_rate)}
              onValueChange={(value) => changeTax(item.id, value)} />
          } />
        </Field>
      ))}
      <Field name="status">
        <FieldLabel>status</FieldLabel>
        <FieldControl render={<Input value={state.status} readOnly />} />
      </Field>
      <Button onClick={submit}>Submit reconciliation</Button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
