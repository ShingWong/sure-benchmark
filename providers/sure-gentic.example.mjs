// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

/**
 * TEMPLATE for a measured provider — not a working benchmark by itself.
 *
 * Copy this file, pin the model id, and make the response parser emit the
 * per-arm call shape documented in arms/README.md. No key is stored here.
 *
 *   export BENCH_MODEL=claude-sonnet-4-5
 *   export BENCH_MODEL_PROVIDER=anthropic      # optional; factory autodetects
 *   npm run bench -- --mode=measured --arm=all --adapter=sure-state \
 *     --provider=$PWD/providers/my-provider.mjs --trials=3
 */
import { LLMProviderFactory } from '@shing.wong/sure-gentic'
import { buildSystemPrompt } from './tool-contracts.mjs'

export function createProvider() {
  const factory = LLMProviderFactory.getInstance()
  const { registered } = factory.initializeFromEnv()
  if (!registered.length) {
    throw new Error(
      'No provider configured. Set OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY.',
    )
  }
  const llm = factory.getProvider(process.env.BENCH_MODEL_PROVIDER)
  if (!llm) throw new Error(`Provider ${process.env.BENCH_MODEL_PROVIDER} not registered (have: ${registered})`)
  const model = process.env.BENCH_MODEL
  if (!model) throw new Error('BENCH_MODEL must be set and pinned for reproducibility')

  return {
    name: `sure-gentic:${llm.name}:${model}`,
    mode: 'measured',
    reportsUsage: true,
    async complete({ prompt, context, contextKind, armName }) {
      const response = await llm.complete(
        [
          { role: 'system', content: buildSystemPrompt({ prompt, armName }) },
          { role: 'user', content: `${contextKind}:\n${context}` },
        ],
        { model, temperature: 0 },
      )
      let call = null
      try {
        call = JSON.parse(String(response.content)).call ?? null
      } catch {
        // An unparseable response is a failed trial, not a silent zero-cost one.
        call = null
      }
      const usage = response.usage
      return {
        usage: usage
          ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
          : null,
        call,
      }
    },
  }
}
