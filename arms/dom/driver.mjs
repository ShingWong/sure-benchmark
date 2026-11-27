// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { chromium } from 'playwright'

const BASE = process.env.BENCH_URL ?? 'http://127.0.0.1:4317'

/** Arm A: browser automation over a conventional React page. */
export async function createDomArm() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const { session } = await (await fetch(`${BASE}/api/session`)).json()
  await page.goto(`${BASE}/dom/?session=${session}`)
  await page.waitForSelector('#ledger-table tbody tr')

  return {
    name: 'dom:react-aria-snapshot',
    async observe() {
      // page.accessibility.snapshot() was removed in Playwright 1.x.
      return {
        context: await page.locator('#reconciliation-root').ariaSnapshot(),
        contextKind: 'aria-snapshot',
      }
    },
    async apply(call) {
      if (!call) return
      // Wait for the server-authoritative state to settle before the next
      // observation, otherwise the agent sees a stale value and retries.
      const before = await page.evaluate(() => window.__bench.getState()?.version)
      if (call.type === 'fill') {
        // A repeated identical fill is a no-op in a real browser too. Without
        // this guard a model that re-applies the correction hangs for 30s.
        const current = await page.inputValue(call.selector)
        if (String(current) !== String(call.value)) {
          await page.fill(call.selector, call.value)
          await page.waitForFunction((v) => window.__bench.getState()?.version > v, before)
        }
      } else if (call.type === 'click') {
        await page.click(call.selector)
        await page.waitForFunction(() => window.__bench.getState()?.status === 'COMMITTED')
      } else {
        throw new Error(`Unknown DOM call: ${JSON.stringify(call)}`)
      }
    },
    async status() {
      const value = (await page.textContent('#status-indicator'))?.trim()
      return value === 'COMMITTED' ? 'COMMITTED' : 'PENDING'
    },
    async result() {
      return page.evaluate(() => window.__bench.getState())
    },
    async dispose() {
      await browser.close()
    },
  }
}
