// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadInvoice, fixtureDigest, DEFAULT_FIXTURE } from '../src/workload.mjs'
import { createFixtureProvider, loadProvider } from '../src/providers.mjs'
import { createContractArm, createReferenceStateMachine, createSureStateArm, createStubArm, ARM_HINTS } from '../src/arms.mjs'
import { runBenchmark } from '../src/harness.mjs'
import { digestFile, summarise, renderMarkdown } from '../src/report.mjs'

function args() {
  const out = {}
  for (const raw of process.argv.slice(2)) {
    const [key, ...rest] = raw.replace(/^--/, '').split('=')
    out[key] = rest.length ? rest.join('=') : true
  }
  return out
}

const argv = args()
const mode = argv.mode ?? 'selftest'
if (!['selftest', 'measured'].includes(mode)) throw new Error(`--mode must be selftest or measured, got ${mode}`)
if (mode === 'measured' && !argv.provider) {
  throw new Error('Measured runs require --provider=/path/to/provider.mjs exporting createProvider()')
}
if (mode === 'selftest' && argv.provider) {
  throw new Error('Self-test uses the built-in fixture provider; drop --provider')
}

const promptPath = argv.prompt ?? new URL('../prompt.txt', import.meta.url)
const fixturePath = argv.fixture ?? DEFAULT_FIXTURE
const prompt = readFileSync(promptPath, 'utf8')
const invoice = loadInvoice(fixturePath)
const provider = mode === 'selftest' ? createFixtureProvider() : await loadProvider(argv.provider)
const adapter = argv.adapter ?? 'reference'
const trials = Number(argv.trials ?? (mode === 'selftest' ? 1 : 3))
const maxTurns = Number(argv['max-turns'] ?? 10)
if (!Number.isInteger(trials) || trials < 1) throw new Error('--trials must be a positive integer')

const requested = String(argv.arm ?? 'contract').split(',')
const names = requested.includes('all') ? ['contract', 'dom', 'ui-sdk', 'ui-sdk-query'] : requested
const pinsPath = new URL('../pins.json', import.meta.url)
const meta = {
  trials,
  fixtureDigest: fixtureDigest(fixturePath),
  pinsDigest: digestFile(pinsPath),
}

const armFactories = names.map((name) => async () => {
  if (name === 'contract' || name === 'sure-state') {
    const fresh = structuredClone(invoice)
    if (name === 'sure-state' || adapter === 'sure-state') return createSureStateArm(fresh)
    return createContractArm(createReferenceStateMachine(fresh))
  }
  if (name === 'dom' || name === 'ui-sdk' || name === 'ui-sdk-query') {
    try {
      const path =
        name === 'dom' ? '../arms/dom/driver.mjs'
          : name === 'ui-sdk' ? '../arms/ui-sdk/driver.mjs'
            : '../arms/ui-sdk/query-driver.mjs'
      const mod = await import(path)
      return name === 'dom' ? await mod.createDomArm()
        : name === 'ui-sdk' ? await mod.createUiSdkArm()
          : await mod.createUiSdkQueryArm()
    } catch (err) {
      return createStubArm(name, `${err.message}. Build the arm and start arms/server.mjs first (arms/README.md).`)
    }
  }
  throw new Error(`Unknown arm: ${name}`)
})

const report = await runBenchmark({
  arms: armFactories,
  provider,
  prompt,
  invoice,
  mode,
  maxTurns,
  meta,
})

const outDir = argv.out ?? new URL('../results/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })
const stamp = `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`
const jsonPath = join(outDir, `${stamp}.json`)
const mdPath = join(outDir, `${stamp}.md`)
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
writeFileSync(mdPath, renderMarkdown(report, summarise(report)))
console.log(renderMarkdown(report, summarise(report)))
console.log(`\nWrote ${jsonPath}\nWrote ${mdPath}`)
