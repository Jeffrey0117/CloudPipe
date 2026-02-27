/**
 * CloudPipe Gateway Client
 *
 * Lightweight client for any sub-project to call Gateway tools.
 * Zero dependencies — uses built-in fetch.
 *
 * Usage:
 *   const gw = require('../../sdk/gateway')
 *   const result = await gw.call('meetube_search', { q: 'React' })
 *   const tools = await gw.tools()
 *   const result = await gw.pipe('youtube-to-flashcards', { query: 'React' })
 */

const { readFileSync } = require('fs')
const { join } = require('path')

const CONFIG_PATH = join(__dirname, '..', 'config.json')

function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function createClient(opts = {}) {
  const config = loadConfig()
  const baseUrl = opts.url
    || process.env.CLOUDPIPE_URL
    || `http://localhost:${config.port || 8787}`
  const token = opts.serviceToken
    || process.env.CLOUDPIPE_TOKEN
    || config.serviceToken
    || ''

  const headers = {
    'content-type': 'application/json',
    'authorization': `Bearer ${token}`,
  }

  async function request(method, path, body) {
    const url = `${baseUrl}${path}`
    const fetchOpts = { method, headers }
    if (body !== undefined) {
      fetchOpts.body = JSON.stringify(body)
    }

    const res = await fetch(url, fetchOpts)
    const text = await res.text()

    let data
    try { data = JSON.parse(text) } catch { data = text }

    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`)
      err.status = res.status
      err.data = data
      throw err
    }

    return data
  }

  return {
    /**
     * Call a gateway tool by name
     * @param {string} toolName - e.g. 'meetube_search', 'upimg_upload'
     * @param {object} params - tool parameters
     * @returns {Promise<{ok, status, data}>}
     */
    call(toolName, params = {}) {
      return request('POST', '/api/gateway/call', { tool: toolName, params })
    },

    /**
     * List all available gateway tools
     * @param {string} [project] - filter by project ID
     * @returns {Promise<{tools, total}>}
     */
    tools(project) {
      const qs = project ? `?project=${encodeURIComponent(project)}` : ''
      return request('GET', `/api/gateway/tools${qs}`)
    },

    /**
     * Execute a pipeline
     * @param {string} pipelineId - e.g. 'youtube-to-flashcards'
     * @param {object} input - pipeline input
     * @returns {Promise<{success, steps, result}>}
     */
    pipe(pipelineId, input = {}) {
      return request('POST', '/api/gateway/pipeline', { pipeline: pipelineId, input })
    },

    /**
     * List all available pipelines
     * @returns {Promise<{pipelines}>}
     */
    pipelines() {
      return request('GET', '/api/gateway/pipelines')
    },

    /**
     * Force refresh the gateway tool cache
     * @returns {Promise<{success, tools}>}
     */
    refresh() {
      return request('POST', '/api/gateway/refresh')
    },
  }
}

// Default singleton (auto-configured from config.json)
const defaultClient = createClient()

module.exports = defaultClient
module.exports.createClient = createClient
