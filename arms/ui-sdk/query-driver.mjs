// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { chromium } from 'playwright'

const BASE = process.env.BENCH_URL ?? 'http://127.0.0.1:4317'

/**
 * Arm B2 — the SAME @ui-sdk/react beta.1 screen, but the agent uses the
 * bridge's `query()` tool to read only the components it needs instead of
 * re-reading the whole `snapshot()` every turn. Included deliberately so the
 * bridge comparison is not a strawman.
 */
export async function createUiSdkQueryArm() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const { session } = await (await fetch(`${BASE}/api/session`)).json()
  await page.goto(`${BASE}/ui-sdk/?session=${session}`)
  await page.waitForFunction(() => Boolean(window.__bench?.agent && window.__bench.getState()))

  let pendingRead = null

  return {
    name: 'ui-sdk:agent-bridge-query',
    async observe() {
      if (pendingRead !== null) {
        const value = pendingRead
        pendingRead = null
        return { context: JSON.stringify(value), contextKind: 'component-query' }
      }
      // Orient once with the full snapshot, as the docs prescribe.
      const snapshot = await page.evaluate(() => window.__bench.agent.snapshot())
      return { context: JSON.stringify(snapshot), contextKind: 'component-snapshot' }
    },
    async apply(call) {
      if (!call) return
      const before = await page.evaluate(() => window.__bench.getState()?.version)
      if (call.tool === 'query') {
        // A read tool: its result becomes the NEXT observation, not a mutation.
        pendingRead = await page.evaluate(
          (input) => window.__bench.agent.query(input),
          call.input ?? {},
        )
        return
      }
      if (call.tool === 'act') {
        await page.evaluate((steps) => window.__bench.agent.act({ steps }), call.steps ?? [])
        if ((call.steps ?? []).some((s) => s.action === 'press')) {
          await page.waitForFunction(() => window.__bench.getState()?.status === 'COMMITTED')
        } else {
          await page.waitForFunction((v) => window.__bench.getState()?.version > v, before)
        }
        // Read back only the status component, never the whole page.
        pendingRead = await page.evaluate(() => window.__bench.agent.query({ text: 'status' }))
        return
      }
      throw new Error(`Unknown bridge-query call: ${JSON.stringify(call)}`)
    },
    async status() {
      const state = await page.evaluate(() => window.__bench.getState())
      return state?.status === 'COMMITTED' ? 'COMMITTED' : 'PENDING'
    },
    async result() {
      return page.evaluate(() => window.__bench.getState())
    },
    async dispose() {
      await browser.close()
    },
  }
}
