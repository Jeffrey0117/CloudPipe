/**
 * CloudPipe MCP Server
 * Core tools + auto-discovered project tools
 */

const { readFileSync } = require('fs')
const { join } = require('path')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const CloudPipe = require('../sdk')
const { registerCoreTools } = require('./core-tools')
const McpDiscovery = require('./discovery')

const CLOUDPIPE_URL = process.env.CLOUDPIPE_URL
const CLOUDPIPE_PASSWORD = process.env.CLOUDPIPE_PASSWORD

if (!CLOUDPIPE_URL || !CLOUDPIPE_PASSWORD) {
  console.error('CLOUDPIPE_URL and CLOUDPIPE_PASSWORD env vars are required')
  process.exit(1)
}

const client = new CloudPipe({ url: CLOUDPIPE_URL, password: CLOUDPIPE_PASSWORD })

const server = new McpServer({
  name: 'cloudpipe',
  version: '2.0.0',
})

// --- Register core platform tools ---
registerCoreTools(server, client)

// --- Build Zod schema from JSON Schema parameters ---
function buildZodSchema(params) {
  if (!params || !params.properties) return {}

  const schema = {}
  const required = new Set(params.required || [])

  for (const [key, prop] of Object.entries(params.properties)) {
    let field

    switch (prop.type) {
      case 'number':
      case 'integer':
        field = z.number()
        break
      case 'boolean':
        field = z.boolean()
        break
      case 'array':
        field = z.array(z.any())
        break
      case 'object':
        field = z.object({}).passthrough()
        break
      default:
        field = z.string()
    }

    if (prop.enum) {
      field = z.enum(prop.enum)
    }

    if (prop.description) {
      field = field.describe(prop.description)
    }

    if (!required.has(key)) {
      field = field.optional()
    }

    schema[key] = field
  }

  return schema
}

// --- Load per-project auth config ---
function loadAuthConfig() {
  try {
    const raw = readFileSync(join(__dirname, '..', 'data', 'manifests', 'auth.json'), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const authConfig = loadAuthConfig()

function getAuthToken(projectId) {
  const config = authConfig[projectId]
  if (!config || config.type === 'none') return null
  if (config.token) return config.token
  if (config.env) return process.env[config.env] || null
  return null
}

// --- Build fetch options for a discovered tool ---
function buildFetchOptions(tool, params) {
  const headers = { 'content-type': 'application/json' }

  // Inject auth token if needed
  if (tool.auth === 'bearer') {
    const token = getAuthToken(tool.project)
    if (token) {
      headers['authorization'] = `Bearer ${token}`
    }
  }

  const opts = { method: tool.method, headers }

  if (tool.method === 'POST' || tool.method === 'PUT' || tool.method === 'PATCH') {
    // Separate path params from body params
    const pathParamNames = (tool.path.match(/\{(\w+)\}/g) || []).map(p => p.slice(1, -1))
    const bodyParams = {}
    for (const [key, val] of Object.entries(params)) {
      if (!pathParamNames.includes(key)) {
        bodyParams[key] = val
      }
    }
    if (Object.keys(bodyParams).length > 0) {
      opts.body = JSON.stringify(bodyParams)
    }
  }

  return opts
}

// --- Resolve path parameters ---
function resolvePath(pathTemplate, params) {
  return pathTemplate.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key]
    return val !== undefined ? encodeURIComponent(val) : `{${key}}`
  })
}

// --- Register auto-discovered project tools ---
async function registerDiscoveredTools() {
  const discovery = new McpDiscovery({
    cloudpipeUrl: CLOUDPIPE_URL,
    cloudpipePassword: CLOUDPIPE_PASSWORD,
  })

  const tools = await discovery.discoverAll()

  for (const tool of tools) {
    const zodSchema = buildZodSchema(tool.parameters)
    const hasParams = Object.keys(zodSchema).length > 0

    const handler = async (params) => {
      try {
        const path = resolvePath(tool.path, params || {})
        const url = `${tool.baseUrl}${path}`
        const opts = buildFetchOptions(tool, params || {})

        // Add query params for GET requests
        let fetchUrl = url
        if (tool.method === 'GET' && params && Object.keys(params).length > 0) {
          const pathParamNames = (tool.path.match(/\{(\w+)\}/g) || []).map(p => p.slice(1, -1))
          const queryEntries = Object.entries(params).filter(([k]) => !pathParamNames.includes(k))
          if (queryEntries.length > 0) {
            const qs = new URLSearchParams(queryEntries).toString()
            fetchUrl = `${url}?${qs}`
          }
        }

        const res = await fetch(fetchUrl, opts)
        const text = await res.text()

        let formatted
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2)
        } catch {
          formatted = text
        }

        if (!res.ok) {
          return { content: [{ type: 'text', text: `HTTP ${res.status}: ${formatted}` }], isError: true }
        }

        return { content: [{ type: 'text', text: formatted }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }

    if (hasParams) {
      server.tool(tool.name, tool.description, zodSchema, handler)
    } else {
      server.tool(tool.name, tool.description, handler)
    }
  }

  return tools.length
}

// --- Start ---
async function main() {
  const discoveredCount = await registerDiscoveredTools()

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`CloudPipe MCP server started (7 core + ${discoveredCount} discovered tools)`)
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err)
  process.exit(1)
})
