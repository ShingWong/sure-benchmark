// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const pins = JSON.parse(readFileSync(new URL('pins.json', root), 'utf8'))
const manifests = [
  { url: new URL('package.json', root), nodeModules: new URL('node_modules/', root) },
  { url: new URL('arms/dom/package.json', root), nodeModules: new URL('arms/dom/node_modules/', root) },
  { url: new URL('arms/ui-sdk/package.json', root), nodeModules: new URL('arms/ui-sdk/node_modules/', root) },
].map((m) => ({ ...m, json: JSON.parse(readFileSync(m.url, 'utf8')) }))

let failures = 0
console.log('Checking exact-version pins for reproducibility...')
for (const [name, pin] of Object.entries(pins.packages)) {
  if (pin.kind === 'python' || pin.kind === 'model' || name === 'node') continue

  const declaredIn = manifests.find((m) => {
    const d = m.json.dependencies?.[name] ?? m.json.optionalDependencies?.[name] ?? m.json.devDependencies?.[name]
    return d !== undefined
  })
  if (!declaredIn) {
    console.log(`  DECL-MISSING  ${name} (pin ${pin.version})`)
    failures += 1
    continue
  }
  const declared =
    declaredIn.json.dependencies?.[name] ??
    declaredIn.json.optionalDependencies?.[name] ??
    declaredIn.json.devDependencies?.[name]
  if (declared !== pin.version) {
    console.log(`  DECL-DRIFT    ${name}: manifest ${declared} != pin ${pin.version}`)
    failures += 1
    continue
  }

  const pkg = new URL(`${name}/package.json`, declaredIn.nodeModules)
  if (!existsSync(fileURLToPath(pkg))) {
    console.log(`  INSTALL-SKIP  ${name}@${pin.version} (npm ci before measured runs)`)
    continue
  }
  const installed = JSON.parse(readFileSync(pkg, 'utf8')).version
  if (installed !== pin.version) {
    console.log(`  INSTALL-DRIFT ${name}: installed ${installed} != pin ${pin.version}`)
    failures += 1
    continue
  }
  console.log(`  OK            ${name}@${installed}`)
}

if (failures) {
  console.error(`\n${failures} pin problem(s). Results are not reproducible until fixed.`)
  process.exit(1)
}
console.log('\nAll declared pins match. Commit all three lockfiles with every pin change.')
