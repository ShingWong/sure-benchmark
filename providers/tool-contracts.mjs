// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

/** Per-arm call shapes shared by every measured provider adapter. */
export const TOOL_CONTRACT = {
  'contract:reference-contract':
    'If any line_item has taxable=true AND tax_rate=0, call {"call":{"name":"updateTaxRate","args":{"id":"<that id>","tax_rate":0.0825,"version":<current version>}}}. Otherwise call {"call":{"name":"submit","args":{"version":<current version>}}}.',
  'contract:sure-state':
    'If any line_item has taxable=true AND tax_rate=0, call {"call":{"name":"updateTaxRate","args":{"id":"<that id>","tax_rate":0.0825,"version":<current version>}}}. Otherwise call {"call":{"name":"submit","args":{"version":<current version>}}}.',
  'dom:react-aria-snapshot':
    'If any taxable row still shows tax rate 0, fill its tax-rate input with 0.0825: {"call":{"type":"fill","selector":"<that input selector>","value":"0.0825"}}. Otherwise click submit: {"call":{"type":"click","selector":"#submit-btn"}}.',
  'ui-sdk:agent-bridge':
    'If any taxable row still shows tax rate 0, set it: {"call":{"steps":[{"ref":"<that row label>","action":"setValue","args":["0.0825"]}],"intent":"update"}}. Otherwise press submit: {"call":{"steps":[{"ref":"Submit reconciliation","action":"press"}],"intent":"submit"}}.',
  'ui-sdk:agent-bridge-query':
    'First use {"call":{"tool":"query","input":{"text":"<row id>"}}}. Then, if the row still shows tax rate 0, use {"call":{"tool":"act","steps":[{"ref":"<that row label>","action":"setValue","args":["0.0825"]}]}}. When no taxable row has tax rate 0, use {"call":{"tool":"act","steps":[{"ref":"Submit reconciliation","action":"press"}]}}.',
}

/**
 * Without this, a small model will happily re-apply the same correction every
 * turn, bump the version each time, and fail the shared verifier. The first
 * measured smoke run did exactly that (10 turns, version 104 → 113).
 */
export const STOP_CONDITION = [
  'STOP CONDITION: read the current state in the context before acting.',
  'If LI-9914 already has tax_rate 0.0825, do NOT call the update again —',
  'your NEXT call must be the submit action (single mutation rule).',
  'Only one update is permitted in the whole task.',
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
