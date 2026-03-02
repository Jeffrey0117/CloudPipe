/**
 * NoteBody — NotebookLM HTTP Bridge for CloudPipe
 *
 * Wraps notebooklm-mcp (stdio MCP server) as an HTTP API service.
 * Uses MCP Client SDK to communicate with the child process.
 *
 * Architecture:
 *   HTTP (port 4010) → server.js → MCP Client (stdio) → notebooklm-mcp → Puppeteer → NotebookLM
 */

import http from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createNotebook, addSource, closeContext as closeBrowser } from './browser.js'

const PORT = process.env.PORT || 4010
const TOKEN = process.env.NOTEBODY_TOKEN || ''

// ==================== MCP Client Manager ====================

let mcpClient = null
let mcpTransport = null
let connected = false
let connecting = false
let restartCount = 0
const MAX_RESTART_DELAY = 30000

async function connectMcp() {
  if (connecting) return
  connecting = true

  try {
    mcpTransport = new StdioClientTransport({
      command: 'npx',
      args: ['notebooklm-mcp'],
      env: { ...process.env },
    })

    mcpClient = new Client({ name: 'notebody', version: '1.0.0' })

    mcpTransport.onclose = () => {
      console.log('[NoteBody] MCP transport closed')
      connected = false
      scheduleReconnect()
    }

    mcpTransport.onerror = (err) => {
      console.error('[NoteBody] MCP transport error:', err.message)
    }

    await mcpClient.connect(mcpTransport)
    connected = true
    restartCount = 0
    console.log('[NoteBody] MCP connected')
  } catch (err) {
    console.error('[NoteBody] MCP connect failed:', err.message)
    connected = false
    scheduleReconnect()
  } finally {
    connecting = false
  }
}

function scheduleReconnect() {
  const delay = Math.min(1000 * Math.pow(2, restartCount), MAX_RESTART_DELAY)
  restartCount++
  console.log(`[NoteBody] Reconnecting in ${delay}ms (attempt ${restartCount})`)
  setTimeout(() => connectMcp(), delay)
}

async function callTool(name, args = {}) {
  if (!connected || !mcpClient) {
    throw new Error('MCP not connected')
  }

  const result = await mcpClient.callTool({ name, arguments: args })

  // MCP returns { content: [{ type: 'text', text: '...' }] }
  // Parse the text content — try JSON first, fall back to raw text
  if (result.content && result.content.length > 0) {
    const text = result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n')

    try {
      return JSON.parse(text)
    } catch {
      return { answer: text }
    }
  }

  return { answer: null }
}

// ==================== Route Table ====================

const ROUTES = [
  // Core Q&A
  { method: 'POST', path: '/api/ask', tool: 'ask_question', timeout: 300000 },

  // Notebook management
  { method: 'GET', path: '/api/notebooks', tool: 'list_notebooks' },
  { method: 'POST', path: '/api/notebooks', tool: 'add_notebook' },
  { method: 'GET', path: '/api/notebooks/:id', tool: 'get_notebook', paramMap: { id: 'notebook_id' } },
  { method: 'PUT', path: '/api/notebooks/:id', tool: 'update_notebook', paramMap: { id: 'notebook_id' } },
  { method: 'DELETE', path: '/api/notebooks/:id', tool: 'remove_notebook', paramMap: { id: 'notebook_id' } },
  { method: 'POST', path: '/api/notebooks/:id/select', tool: 'select_notebook', paramMap: { id: 'notebook_id' } },
  { method: 'GET', path: '/api/search', tool: 'search_notebooks' },

  // Sessions
  { method: 'GET', path: '/api/sessions', tool: 'list_sessions' },
  { method: 'DELETE', path: '/api/sessions/:id', tool: 'close_session', paramMap: { id: 'session_id' } },

  // Admin (not in manifest — for one-time setup)
  { method: 'POST', path: '/api/auth/setup', tool: 'setup_auth', timeout: 600000 },

  // Browser automation (bypass MCP, call browser.js directly)
  {
    method: 'POST', path: '/api/auto/create', timeout: 120000,
    handler: async (args) => createNotebook({ title: args.title }),
  },
  {
    method: 'POST', path: '/api/auto/source', timeout: 120000,
    handler: async (args) => addSource(args.notebook_url, args.source_url),
  },
]

// ==================== Route Matcher ====================

function matchRoute(method, pathname) {
  for (const route of ROUTES) {
    if (route.method !== method) continue

    // Build regex from path pattern
    const paramNames = []
    const pattern = route.path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${pattern}$`)
    const match = pathname.match(regex)

    if (match) {
      const pathParams = {}
      paramNames.forEach((name, i) => {
        const mappedName = route.paramMap?.[name] || name
        pathParams[mappedName] = decodeURIComponent(match[i + 1])
      })
      return { route, pathParams }
    }
  }
  return null
}

// ==================== HTTP Helpers ====================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  })
  res.end(JSON.stringify(data))
}

function isAuthorized(req) {
  if (!TOKEN) return true
  const auth = req.headers['authorization'] || ''
  return auth === `Bearer ${TOKEN}`
}

// ==================== HTTP Server ====================

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, null)
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname

  // Health check (no auth required)
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      success: true,
      name: 'NoteBody',
      version: '1.0.0',
      mcp: { connected },
      timestamp: new Date().toISOString(),
    })
  }

  // Auth check
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  // Route matching
  const matched = matchRoute(req.method, pathname)
  if (!matched) {
    return sendJson(res, 404, { error: 'Not found' })
  }

  const { route, pathParams } = matched

  // Check MCP connection (only for MCP tool routes, not handler routes)
  if (!route.handler && !connected) {
    return sendJson(res, 503, { error: 'MCP not connected, try again later' })
  }

  try {
    // Build tool arguments from body + path params + query params
    let body = {}
    if (req.method !== 'GET') {
      body = await parseBody(req)
    }

    // Merge query params for GET requests
    const queryParams = {}
    for (const [key, val] of url.searchParams) {
      queryParams[key] = val
    }

    const toolArgs = { ...queryParams, ...body, ...pathParams }

    // Call handler directly or MCP tool, with timeout
    const timeout = route.timeout || 120000
    const operation = route.handler
      ? route.handler(toolArgs)
      : callTool(route.tool, toolArgs)

    const result = await Promise.race([
      operation,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ])

    sendJson(res, 200, { success: true, data: result })
  } catch (err) {
    const status = err.message === 'Request timeout' ? 504
      : err.message === 'MCP not connected' ? 503
      : 500
    sendJson(res, status, { success: false, error: err.message })
  }
})

// ==================== Lifecycle ====================

async function start() {
  await connectMcp()
  server.listen(PORT, () => {
    console.log(`[NoteBody] Listening on port ${PORT}`)
  })
}

async function shutdown() {
  console.log('[NoteBody] Shutting down...')
  try {
    await closeBrowser()
  } catch {
    // ignore
  }
  try {
    if (mcpClient) {
      await mcpClient.close()
    }
  } catch {
    // ignore
  }
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()
