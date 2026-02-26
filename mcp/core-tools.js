/**
 * Core CloudPipe MCP Tools
 * 平台管理工具：list projects, deploy, restart, logs, etc.
 */

const { z } = require('zod')

function registerCoreTools(server, client) {
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
}

module.exports = { registerCoreTools }
