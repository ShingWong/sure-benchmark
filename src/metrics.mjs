// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { performance } from 'node:perf_hooks'

/**
 * Token usage is either fully reported by the provider or absent. A missing
 * value is recorded as null — never estimated from character counts, heuristics
 * or hardcoded constants. This is the core honesty rule of the harness.
 */
export function freshUsage() {
  return { promptTokens: 0, completionTokens: 0, reported: true }
}

export function mergeUsage(total, next) {
  const ok =
    total.reported &&
    next != null &&
    Number.isFinite(next.promptTokens) &&
    Number.isFinite(next.completionTokens)
  if (!ok) return { promptTokens: null, completionTokens: null, reported: false }
  return {
    promptTokens: total.promptTokens + next.promptTokens,
    completionTokens: total.completionTokens + next.completionTokens,
    reported: true,
  }
}

export function elapsedMs(start) {
  return +(performance.now() - start).toFixed(2)
}

export function publicUsage(usage) {
  return usage.reported
    ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
    : { promptTokens: null, completionTokens: null }
}
