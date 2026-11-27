// SPDX-License-Identifier: AGPL-3.0-or-later OR LicenseRef-Commercial
// Project lextelligent

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadInvoice } from '../src/workload.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const invoice = loadInvoice()
const sessions = new Map()
const port = Number(process.env.BENCH_PORT ?? 4317)
const host = '127.0.0.1'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }

function body(req) {
  return new Promise((resolve, reject) => {
    let text = ''
    req.on('data', (chunk) => { text += chunk })
    req.on('end', () => { try { resolve(text ? JSON.parse(text) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function stateOf(session) {
  return sessions.get(session) ?? null
}

function send(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function serveStatic(res, url) {
  const match = url.match(/^\/(dom|ui-sdk)\/(.*)$/)
  if (!match) return false
  const base = join(root, 'arms', match[1], 'dist')
  const relative = match[2] || 'index.html'
  const file = join(base, relative)
  if (!file.startsWith(base) || !existsSync(file)) {
    res.writeHead(404); res.end('not found'); return true
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
  return true
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`)

  if (req.method === 'GET' && url.pathname === '/api/session') {
    const session = randomUUID()
    sessions.set(session, { ...structuredClone(invoice), status: 'PENDING' })
    return send(res, 200, { session })
  }
  if (req.method === 'GET' && serveStatic(res, url.pathname)) return

  if (req.method === 'GET' && url.pathname === '/api/invoice') {
    const state = stateOf(url.searchParams.get('session'))
    return state ? send(res, 200, state) : send(res, 404, { error: 'unknown session' })
  }
  if (req.method === 'POST' && url.pathname === '/api/update') {
    const input = await body(req)
    const state = stateOf(input.session)
    if (!state) return send(res, 404, { error: 'unknown session' })
    // Shared version fence: every browser arm obeys the same rule as Arm C.
    if (input.version !== state.version) {
      return send(res, 409, { error: 'CONCURRENCY_ERROR', version: state.version })
    }
    const item = state.line_items.find((i) => i.id === input.id)
    if (!item) return send(res, 404, { error: 'ITEM_NOT_FOUND' })
    item[input.field] = Number(input.value)
    state.version += 1
    return send(res, 200, item)
  }
  if (req.method === 'POST' && url.pathname === '/api/commit') {
    const input = await body(req)
    const state = stateOf(input.session)
    if (!state) return send(res, 404, { error: 'unknown session' })
    if (input.version !== state.version) {
      return send(res, 409, { error: 'VERSION_MISMATCH', version: state.version })
    }
    state.status = 'COMMITTED'
    return send(res, 200, { status: 'COMMITTED', version: state.version })
  }

  send(res, 404, { error: 'not found' })
})

server.listen(port, host, () => {
  console.log(`bench server on http://${host}:${port} (127.0.0.1 only)`)
})
