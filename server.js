// Tiny dependency-free server: serves the built app and persists state to a JSON file.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'budgets.json')
const DIST = path.join(__dirname, 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

await fs.mkdir(DATA_DIR, { recursive: true })

function readBody(req, limit = 5_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleApi(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'GET') {
    try {
      res.end(await fs.readFile(DATA_FILE, 'utf8'))
    } catch {
      res.end(JSON.stringify({ budgets: [] }))
    }
    return
  }
  if (req.method === 'PUT') {
    try {
      const parsed = JSON.parse(await readBody(req))
      if (!parsed || !Array.isArray(parsed.budgets)) throw new Error('bad shape')
      const tmp = DATA_FILE + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(parsed))
      await fs.rename(tmp, DATA_FILE) // atomic swap so a crash never corrupts data
      res.end('{"ok":true}')
    } catch (e) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: String(e.message) }))
    }
    return
  }
  res.statusCode = 405
  res.end('{}')
}

async function handleStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.normalize(path.join(DIST, urlPath))
  if (!file.startsWith(DIST)) {
    res.statusCode = 403
    return res.end()
  }
  try {
    const stat = await fs.stat(file)
    if (stat.isDirectory()) file = path.join(file, 'index.html')
    await fs.access(file)
  } catch {
    file = path.join(DIST, 'index.html') // SPA fallback
  }
  try {
    const data = await fs.readFile(file)
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
    if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('Not found')
  }
}

http
  .createServer((req, res) => {
    const handler = req.url.startsWith('/api/state') ? handleApi : handleStatic
    handler(req, res).catch(() => {
      res.statusCode = 500
      res.end()
    })
  })
  .listen(PORT, () => console.log(`Budgetly on :${PORT}, data in ${DATA_FILE}`))
