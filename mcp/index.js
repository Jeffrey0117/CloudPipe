/**
 * CloudPipe MCP Server
 * 讓 Claude Code 透過自然語言管理 CloudPipe
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const CloudPipe = require('../sdk')

const CLOUDPIPE_URL = process.env.CLOUDPIPE_URL
const CLOUDPIPE_PASSWORD = process.env.CLOUDPIPE_PASSWORD

if (!CLOUDPIPE_URL || !CLOUDPIPE_PASSWORD) {
  console.error('CLOUDPIPE_URL and CLOUDPIPE_PASSWORD env vars are required')
  process.exit(1)
}

const client = new CloudPipe({ url: CLOUDPIPE_URL, password: CLOUDPIPE_PASSWORD })

const server = new McpServer({
  name: 'cloudpipe',
  version: '1.0.0',
})

// --- Tools ---

server.tool(
  'list_projects',
  'List all CloudPipe projects with their status',
  async () => {
    try {
      const projects = await client.projects.list()
      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'get_project',
  'Get project details and recent deployments',
  { id: z.string().describe('Project ID') },
  async ({ id }) => {
    try {
      const data = await client.projects.get(id)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'deploy_project',
  'Trigger a deployment for a project',
  { id: z.string().describe('Project ID') },
  async ({ id }) => {
    try {
      const result = await client.deploy(id)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'restart_project',
  'Restart a project via PM2',
  { id: z.string().describe('Project ID') },
  async ({ id }) => {
    try {
      const result = await client.restart(id)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'get_logs',
  'Get PM2 logs for a project',
  { id: z.string().describe('Project ID (pm2Name)') },
  async ({ id }) => {
    try {
      const data = await client.logs(id)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'get_deployments',
  'Get deployment history (all or for a specific project)',
  { id: z.string().optional().describe('Project ID (optional, omit for all)') },
  async ({ id }) => {
    try {
      let data
      if (id) {
        const project = await client.projects.get(id)
        data = project.deployments || []
      } else {
        data = await client.deployments.list()
      }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

server.tool(
  'system_info',
  'Get CloudPipe system information',
  async () => {
    try {
      const data = await client.system()
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
)

// --- Start ---

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('CloudPipe MCP server started')
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err)
  process.exit(1)
})
