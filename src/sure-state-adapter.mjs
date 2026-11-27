// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

/**
 * Real sure-state adapter for Arm C. Loaded only when --adapter=sure-state is
 * selected, so `npm test` stays dependency-free.
 */
export async function createSureStateStateMachine(invoice) {
  let mod
  try {
    mod = await import('@shing.wong/sure-state')
  } catch (err) {
    throw new Error(
      `sure-state adapter needs the pinned package: npm install @shing.wong/sure-state@0.1.10 (${err.message})`,
    )
  }
  const { createEntityStore, versionWhere, ConflictError, createAgentTools } = mod

  const rows = new Map(
    invoice.line_items.map((i) => [i.id, { ...i, version: invoice.version }]),
  )
  let version = invoice.version
  let committed = false

  function fence(expected) {
    // versionWhere is the single source of truth for the fence clause.
    const clause = versionWhere({ version: expected })
    if (expected !== version) throw new ConflictError('Invoice')
    return clause
  }

  const api = {
    list: async () => [...rows.values()],
    getById: async (id) => rows.get(id) ?? null,
    create: async () => { throw new Error('not used in this workload') },
    remove: async () => { throw new Error('not used in this workload') },
    updateField: async (id, field, value, expectedVersion) => {
      fence(expectedVersion)
      const row = rows.get(id)
      if (!row) throw new Error('ITEM_NOT_FOUND')
      rows.set(id, { ...row, [field]: value, version: version + 1 })
      version += 1
      return { ...rows.get(id) }
    },
    update: async (id, updates) => {
      fence(updates.version)
      const row = rows.get(id)
      if (!row) throw new Error('ITEM_NOT_FOUND')
      const { version: _ignored, ...fields } = updates
      rows.set(id, { ...row, ...fields, version: version + 1 })
      version += 1
      return { ...rows.get(id) }
    },
  }

  const store = createEntityStore({ name: 'reconciliation_contract', api, versioning: true })
  await store.fetch()
  const tools = createAgentTools({ stores: { reconciliation_contract: store } })

  function getState() {
    const line_items = store.items
    return {
      invoice_id: invoice.invoice_id,
      customer_id: invoice.customer_id,
      version,
      line_items,
      status: committed ? 'COMMITTED' : 'PENDING',
    }
  }

  return {
    name: 'sure-state',
    tools,
    getState,
    async updateField(id, field, value) {
      // createEntityStore resolves expectedVersion from its own snapshot.
      return store.updateField(id, field, value)
    },
    async submit() {
      fence(version)
      committed = true
      return { status: 'COMMITTED', version }
    },
    async result() {
      const state = getState()
      return { line_items: state.line_items, version: state.version, status: state.status }
    },
  }
}
