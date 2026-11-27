// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

/** Per-arm call shapes shared by every measured provider adapter. */
export const TOOL_CONTRACT = {
  'contract:reference-contract':
    'Inspect the contract state. If any line_item has taxable=true AND tax_rate=0, call {"call":{"name":"updateTaxRate","args":{"id":"<that id>","tax_rate":0.0825,"version":<current version>}}}. If no taxable item has tax_rate 0, call {"call":{"name":"submit","args":{"version":<current version>}}}.',
  'contract:sure-state':
    'Inspect the contract state. If any line_item has taxable=true AND tax_rate=0, call {"call":{"name":"updateTaxRate","args":{"id":"<that id>","tax_rate":0.0825,"version":<current version>}}}. If no taxable item has tax_rate 0, call {"call":{"name":"submit","args":{"version":<current version>}}}.',
  'dom:react-aria-snapshot':
    'The context is an ARIA snapshot. Each row shows its tax rate as TEXT (tax-rate-value-<id>) and as a spinbutton. Look at the row for LI-9914. If its tax rate text is "0", fill its spinbutton: {"call":{"type":"fill","selector":"[aria-label=\\"tax-rate-LI-9914\\"]","value":"0.0825"}}. If its tax rate text is already "0.0825", IMMEDIATELY click submit: {"call":{"type":"click","selector":"#submit-btn"}}. Ignore other rows — non-taxable rows legitimately show 0.',
  'ui-sdk:agent-bridge':
    'The context is a component snapshot. Each row has field taxable-<id> with value "true" or "false". Only a row whose taxable-<id> is "true" AND whose tax-rate-<id> value is "0" needs correction. Do NOT change rows with taxable value "false". Set the faulty row with {"call":{"steps":[{"ref":"tax-rate-<that id>","action":"setValue","args":["0.0825"]}],"intent":"update"}}. When no taxable row has value "0", press submit: {"call":{"steps":[{"ref":"Submit reconciliation","action":"press"}],"intent":"submit"}}.',
  'ui-sdk:agent-bridge-query':
    'First use {"call":{"tool":"query","input":{"text":"taxable-LI-9914"}}} and {"call":{"tool":"query","input":{"text":"LI-9914"}}} to read that row. Only rows whose taxable-<id> field is "true" and tax rate is "0" need correction; do not change rows with taxable value "false". Use {"call":{"tool":"act","steps":[{"ref":"tax-rate-<that id>","action":"setValue","args":["0.0825"]}]}}. When no taxable row has value "0", use {"call":{"tool":"act","steps":[{"ref":"Submit reconciliation","action":"press"}]}}.',
}

/**
 * A small model will otherwise re-apply the single correction every turn and
 * fail the shared verifier. The first measured smoke did exactly that
 * (10 turns, version 104 → 113). The DOM arm did the same thing and hit a
 * driver timeout; the driver now treats an identical fill as a no-op.
 */
export const STOP_CONDITION = [
  'STOP CONDITION: read the current context before every call.',
  'If the field or line_item for LI-9914 ALREADY shows 0.0825,',
  'do NOT repeat the update — your NEXT call MUST be the submit action.',
  'Exactly one update is permitted in the whole task.',
].join(' ')

export function buildSystemPrompt({ prompt, armName }) {
  return [
    prompt,
    `You are driving the "${armName}" arm. Reply with JSON ONLY, exactly {"call": ...}.`,
    `Allowed calls for this arm: ${TOOL_CONTRACT[armName] ?? '{"call":{"name":"submit","args":{}}}'}`,
    STOP_CONDITION,
    'Do not include prose, markdown fences or explanations.',
  ].join('\n\n')
}
