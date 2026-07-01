// Production server: a Node HTTP server wrapping the TanStack Start fetch handler
// (dist/server/server.js) and serving the client assets (dist/client). Keeps the
// streaming pump so SSE chat responses flush incrementally.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import server from './dist/server/server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')
const port = parseInt(process.env.PORT || '3000', 10)
const host = process.env.HOST || '0.0.0.0'

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

async function tryServeStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)
  if (pathname.includes('..')) return false

  const filePath = join(CLIENT_DIR, pathname)
  if (!filePath.startsWith(CLIENT_DIR)) return false

  // Hashed asset requests must 404 (not fall through to the HTML shell) so stale
  // chunks after a deploy fail cleanly instead of rendering a blank SPA.
  const isAsset = pathname.startsWith('/assets/')
  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) throw new Error('not a file')
    const ext = extname(filePath).toLowerCase()
    const data = await readFile(filePath)
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Content-Length': data.length }
    if (isAsset) headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    res.writeHead(200, headers)
    res.end(data)
    return true
  } catch {
    if (isAsset) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      res.end('Asset not found')
      return true
    }
    return false
  }
}

async function requestHandler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (await tryServeStatic(req, res)) return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
  }

  let body = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  const request = new Request(url.toString(), { method: req.method, headers, body, duplex: 'half' })
  try {
    const response = await server.fetch(request)
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (response.body) {
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
      res.end()
    } else {
      res.end(await response.text())
    }
  } catch (err) {
    console.error('[talaria-ui] request error:', err)
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal Server Error')
  }
}

createServer(requestHandler).listen(port, host, () => {
  console.log(`[talaria-ui] listening on http://${host}:${port}`)
})
