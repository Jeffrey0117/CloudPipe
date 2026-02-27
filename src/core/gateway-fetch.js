/**
 * Gateway Fetch — shared HTTP call logic for MCP + Gateway
 *
 * Extracted from mcp/index.js so both the MCP server and
 * the internal gateway can call project APIs without duplication.
 */

const { readFileSync } = require('fs')
const { join } = require('path')

const AUTH_CONFIG_PATH = join(__dirname, '..', '..', 'data', 'manifests', 'auth.json')

// --- Auth config ---

function loadAuthConfig() {
  try {
    const raw = readFileSync(AUTH_CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function getAuthToken(projectId, authConfig) {
  const config = authConfig[projectId]
  if (!config || config.type === 'none') return null
  if (config.token) return config.token
  if (config.env) return process.env[config.env] || null
  return null
}

// --- Path resolution ---

function resolvePath(pathTemplate, params) {
  return pathTemplate.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key]
    return val !== undefined ? encodeURIComponent(val) : `{${key}}`
  })
}

// --- Build fetch options ---

function buildFetchOptions(tool, params, authConfig) {
  const headers = { 'content-type': 'application/json' }

  if (tool.auth === 'bearer') {
    const token = getAuthToken(tool.project, authConfig)
    if (token) {
      headers['authorization'] = `Bearer ${token}`
    }
  }

  const opts = { method: tool.method, headers }

  if (tool.method === 'POST' || tool.method === 'PUT' || tool.method === 'PATCH') {
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

// --- Full HTTP call ---

async function callTool(tool, params, authConfig) {
  const safeParams = params || {}
  const path = resolvePath(tool.path, safeParams)
  const url = `${tool.baseUrl}${path}`
  const opts = buildFetchOptions(tool, safeParams, authConfig)

  let fetchUrl = url
  if (tool.method === 'GET' && Object.keys(safeParams).length > 0) {
    const pathParamNames = (tool.path.match(/\{(\w+)\}/g) || []).map(p => p.slice(1, -1))
    const queryEntries = Object.entries(safeParams).filter(([k]) => !pathParamNames.includes(k))
    if (queryEntries.length > 0) {
      const qs = new URLSearchParams(queryEntries).toString()
      fetchUrl = `${url}?${qs}`
    }
  }

  const res = await fetch(fetchUrl, opts)
  const text = await res.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return { status: res.status, ok: res.ok, data }
}

module.exports = {
  loadAuthConfig,
  getAuthToken,
  resolvePath,
  buildFetchOptions,
  callTool
}
