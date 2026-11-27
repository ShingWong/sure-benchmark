// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { performance } from 'node:perf_hooks'

/**
 * Real measured provider: Google AI Studio REST, direct, with REAL token usage.
 *
 * sure-gentic's GoogleAIStudioProvider does not expose usageMetadata from
 * complete(), so this adapter calls the REST endpoint itself. No SDK and no
 * credentials in the repository.
 *
 *   export GEMINI_API_KEY=...          # never commit
 *   export BENCH_MODEL=gemini-2.5-flash-lite
 *   npm run bench -- --mode=measured --arm=all --adapter=sure-state \
 *     --provider=$PWD/providers/gemini.mjs --trials=3
 */

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
])
const API_VERSION = 'v1beta'

import { buildSystemPrompt } from './tool-contracts.mjs'

export function createProvider() {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (!key) throw new Error('Set GEMINI_API_KEY (or GOOGLE_API_KEY) for measured runs')
  const model = process.env.BENCH_MODEL
  if (!model || !ALLOWED_MODELS.has(model)) {
    throw new Error(`BENCH_MODEL must be one of ${[...ALLOWED_MODELS].join(', ')}`)
  }

  return {
    name: `gemini:${model}:${API_VERSION}`,
    mode: 'measured',
    reportsUsage: true,
    async complete({ prompt, context, contextKind, armName }) {
      const system = buildSystemPrompt({ prompt, armName })

      const started = performance.now()
      const res = await fetch(
        `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: `${contextKind}:\n${context}` }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(60000),
        },
      )
      const latencyMs = +(performance.now() - started).toFixed(2)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(`Gemini HTTP ${res.status}: ${data?.error?.message ?? 'unknown error'}`)
      }

      let call = null
      try {
        call = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}').call ?? null
      } catch {
        // An unparseable reply is a failed trial, not a silent free call.
        call = null
      }
      const u = data.usageMetadata ?? {}
      return {
        call,
        latencyMs,
        usage:
          Number.isFinite(u.promptTokenCount) && Number.isFinite(u.candidatesTokenCount)
            ? { promptTokens: u.promptTokenCount, completionTokens: u.candidatesTokenCount }
            : null,
      }
    },
  }
}
