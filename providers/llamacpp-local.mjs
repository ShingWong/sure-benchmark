// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { performance } from 'node:perf_hooks'
import { basename } from 'node:path'
import { buildSystemPrompt } from './tool-contracts.mjs'

/**
 * Real measured provider for a local llama.cpp OpenAI-compatible server.
 *
 * The address and model are supplied at RUN TIME by environment variables.
 * No internal host, path or credential is stored in this repository.
 *
 *   export BENCH_BASE_URL=http://<host>:<port>/v1
 *   export BENCH_MODEL=<exact model id reported by /v1/models>
 *   npm run bench -- --mode=measured --arm=all --adapter=sure-state \
 *     --provider=$PWD/providers/llamacpp-local.mjs --trials=3
 */
const DEFAULT_BASE = 'http://127.0.0.1:8080/v1'

export function createProvider() {
  const base = (process.env.BENCH_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
  const model = process.env.BENCH_MODEL
  if (!model) throw new Error('BENCH_MODEL must be set to the exact local model id')

  return {
    name: `llamacpp:${basename(model)}`,
    mode: 'measured',
    reportsUsage: true,
    async complete({ prompt, context, contextKind, armName }) {
      const started = performance.now()
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt({ prompt, armName }) },
            { role: 'user', content: `${contextKind}:\n${context}` },
          ],
          temperature: 0,
          max_tokens: 512,
          response_format: { type: 'json_object' },
          // Qwen3.x thinks by default; thinking would consume the token budget
          // before the JSON answer is emitted.
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(180000),
      })
      const latencyMs = +(performance.now() - started).toFixed(2)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(`local server HTTP ${res.status}: ${data?.error?.message ?? 'unknown error'}`)
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
