// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { chromium } from 'playwright'

const BASE = process.env.BENCH_URL ?? 'http://127.0.0.1:4317'

/** Arm B: component bridge over @ui-sdk/react beta.1. */
export async function createUiSdkArm() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const { session } = await (await fetch(`${BASE}/api/session`)).json()
  await page.goto(`${BASE}/ui-sdk/?session=${session}`)
  await page.waitForFunction(() => Boolean(window.__bench?.agent && window.__bench.getState()))

  return {
    name: 'ui-sdk:agent-bridge',
    async observe() {
      // Verified beta.1 API: snapshot() is synchronous and returns an array.
      const snapshot = await page.evaluate(() => window.__bench.agent.snapshot())
      return { context: JSON.stringify(snapshot), contextKind: 'component-snapshot' }
    },
    async apply(call) {
      if (!call?.steps) return
      const before = await page.evaluate(() => window.__bench.getState()?.version)
      // act() result is not trusted as proof of a change; status() re-reads.
      await page.evaluate((steps) => window.__bench.agent.act({ steps }), call.steps)
      if (call.steps.some((s) => s.action === 'press')) {
        await page.waitForFunction(() => window.__bench.getState()?.status === 'COMMITTED')
      } else {
        await page.waitForFunction((v) => window.__bench.getState()?.version > v, before)
      }
    },
    async status() {
      const snapshot = await page.evaluate(() => window.__bench.agent.snapshot())
      return snapshot.find((c) => c.label === 'status')?.value === 'COMMITTED' ? 'COMMITTED' : 'PENDING'
    },
    async result() {
      return page.evaluate(() => window.__bench.getState())
    },
    async dispose() {
      await browser.close()
    },
  }
}
