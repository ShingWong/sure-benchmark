// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { performance } from 'node:perf_hooks'
import { buildSystemPrompt } from './tool-contracts.mjs'

/**
 * Real measured provider via OpenRouter Chat Completions.
 *
 * Use this to run the SAME model family as the published Vercel benchmark
 * (Sonnet via Claude Code) with real provider-reported token usage.
 *
 *   export OPENROUTER_API_KEY=...                 # never commit
 *   export BENCH_MODEL=anthropic/claude-sonnet-4.5  # pin the exact id
 *   npm run bench -- --mode=measured --arm=all --adapter=sure-state \
 *     --provider=$PWD/providers/openrouter.mjs --trials=3
 */
const API = 'https://openrouter.ai/api/v1/chat/completions'

export function createProvider() {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('Set OPENROUTER_API_KEY for measured runs')
  const model = process.env.BENCH_MODEL
  if (!model) throw new Error('BENCH_MODEL must be set to an exact OpenRouter model id')

  return {
    name: `openrouter:${model}`,
    mode: 'measured',
    reportsUsage: true,
    async complete({ prompt, context, contextKind, armName }) {
      const started = performance.now()
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://github.com/ShingWong/sure-benchmark',
          'X-Title': 'sure-benchmark',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt({ prompt, armName }) },
            { role: 'user', content: `${contextKind}:\n${context}` },
          ],
          temperature: 0,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(120000),
      })
      const latencyMs = +(performance.now() - started).toFixed(2)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(`OpenRouter HTTP ${res.status}: ${data?.error?.message ?? 'unknown error'}`)
      }

      let call = null
      try {
        call = JSON.parse(data.choices?.[0]?.message?.content ?? '{}').call ?? null
      } catch {
        call = null
      }
      const u = data.usage ?? {}
      return {
        call,
        latencyMs,
        usage:
          Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)
            ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens }
            : null,
      }
    },
  }
}
