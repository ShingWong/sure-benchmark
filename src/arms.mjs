// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { computeTotals } from './workload.mjs'

export class NotImplementedError extends Error {
  constructor(name, hint) {
    super(`${name} arm is not built yet. ${hint}`)
    this.name = 'NotImplementedError'
  }
}

/**
 * Plain-JS reference state machine for the harness self-test. It implements
 * the SAME version-fence rule as the sure-state adapter so the self-test
 * exercises identical logic; it is not presented as the sure stack.
 */
export function createReferenceStateMachine(invoice) {
  const rows = new Map(invoice.line_items.map((i) => [i.id, { ...i }]))
  let version = invoice.version
  let committed = false

  function getState() {
    const line_items = [...rows.values()]
    return {
      invoice_id: invoice.invoice_id,
      customer_id: invoice.customer_id,
      version,
      line_items,
      ...computeTotals(line_items),
      status: committed ? 'COMMITTED' : 'PENDING',
    }
  }

  function fence(expected) {
    if (expected !== undefined && expected !== version) {
      throw new Error(`CONCURRENCY_ERROR: state ${version} != expected ${expected}`)
    }
  }

  return {
    name: 'reference-contract',
    getState,
    async updateField(id, field, value, expectedVersion) {
      fence(expectedVersion)
      const row = rows.get(id)
      if (!row) throw new Error('ITEM_NOT_FOUND')
      rows.set(id, { ...row, [field]: value })
      version += 1
      return { ...rows.get(id) }
    },
    async submit(expectedVersion) {
      fence(expectedVersion)
      committed = true
      return { status: 'COMMITTED', version, ...getState() }
    },
  }
}

/** Generic contract arm: works with any state machine exposing the interface above. */
export function createContractArm(stateMachine) {
  return {
    name: `contract:${stateMachine.name ?? 'state-machine'}`,
    async observe() {
      return { context: JSON.stringify(stateMachine.getState()), contextKind: 'contract-state' }
    },
    async apply(call) {
      if (!call) return
      const expected = call.args?.version
      if (call.name === 'updateTaxRate') {
        await stateMachine.updateField(call.args.id, 'tax_rate', call.args.tax_rate, expected)
      } else if (call.name === 'submit') {
        await stateMachine.submit(expected)
      } else {
        throw new Error(`Unknown contract call: ${call.name ?? '(none)'}`)
      }
    },
    async status() {
      return stateMachine.getState().status ?? 'PENDING'
    },
    async result() {
      const state = stateMachine.getState()
      return { line_items: state.line_items, version: state.version, status: state.status }
    },
  }
}

/** Dynamically loads the real sure-state adapter; never imported in the self-test path. */
export async function createSureStateArm(invoice) {
  const { createSureStateStateMachine } = await import('./sure-state-adapter.mjs')
  return createContractArm(await createSureStateStateMachine(invoice))
}

export function createStubArm(name, hint) {
  return {
    name,
    stub: true,
    async observe() {
      throw new NotImplementedError(name, hint)
    },
    async apply() {},
    async status() {
      return 'PENDING'
    },
    async result() {
      return { line_items: [], version: 0, status: 'PENDING' }
    },
  }
}

export const ARM_HINTS = {
  dom: 'Build arms/dom (neutral React page + Playwright driver) before running this arm.',
  'ui-sdk': 'Build arms/ui-sdk (@ui-sdk/react beta.1 screen + bridge driver) before running this arm.',
}
