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
    'create_project',
    'Register a new project in CloudPipe',
    {
      id: z.string().describe('Project ID (lowercase, no spaces)'),
      name: z.string().describe('Display name'),
      repoUrl: z.string().optional().describe('GitHub repo URL'),
      branch: z.string().optional().describe('Git branch (default: master)'),
      port: z.number().describe('Port number'),
      entryFile: z.string().optional().describe('Entry file (e.g. server.js)'),
      buildCommand: z.string().optional().describe('Build command (e.g. npm run build)'),
      healthEndpoint: z.string().optional().describe('Health check path (e.g. /api/health)'),
      runner: z.enum(['node', 'next', 'tsx']).optional().describe('PM2 runner type'),
      description: z.string().optional().describe('Project description'),
    },
    async (params) => {
      try {
        const data = {
          ...params,
          deployMethod: params.repoUrl ? 'github' : 'local',
          branch: params.branch || 'master',
          directory: `projects/${params.id}`,
          pm2Name: params.id,
        }
        const result = await client.projects.create(data)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  server.tool(
    'update_project',
    'Update an existing project configuration',
    {
      id: z.string().describe('Project ID'),
      name: z.string().optional().describe('Display name'),
      repoUrl: z.string().optional().describe('GitHub repo URL'),
      branch: z.string().optional().describe('Git branch'),
      port: z.number().optional().describe('Port number'),
      entryFile: z.string().optional().describe('Entry file'),
      buildCommand: z.string().optional().describe('Build command'),
      healthEndpoint: z.string().optional().describe('Health check path'),
      runner: z.enum(['node', 'next', 'tsx']).optional().describe('PM2 runner type'),
      description: z.string().optional().describe('Project description'),
    },
    async ({ id, ...updates }) => {
      try {
        const result = await client.projects.update(id, updates)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  server.tool(
    'delete_project',
    'Remove a project from CloudPipe',
    { id: z.string().describe('Project ID') },
    async ({ id }) => {
      try {
        const result = await client.projects.delete(id)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
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

  server.tool(
    'machines',
    'Get status of all CloudPipe machines and tunnel connectors',
    async () => {
      try {
        const data = await client.machines()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  server.tool(
    'rollback_project',
    'Rollback a project to its previous running commit (or a specific commit)',
    {
      id: z.string().describe('Project ID'),
      commit: z.string().optional().describe('Target commit hash (defaults to last running commit)'),
    },
    async ({ id, commit }) => {
      try {
        const result = await client.rollback(id, commit)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  // --- Scheduler tools ---

  server.tool(
    'list_schedules',
    'List all scheduled tasks with their status, cron expression, and last run',
    async () => {
      try {
        const scheduler = require('../src/core/scheduler')
        const schedules = scheduler.listSchedules()
        return { content: [{ type: 'text', text: JSON.stringify(schedules, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  server.tool(
    'run_schedule',
    'Manually trigger a scheduled task immediately',
    { id: z.string().describe('Schedule ID') },
    async ({ id }) => {
      try {
        const scheduler = require('../src/core/scheduler')
        const result = await scheduler.runSchedule(id)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )

  server.tool(
    'toggle_schedule',
    'Enable or disable a scheduled task',
    { id: z.string().describe('Schedule ID') },
    async ({ id }) => {
      try {
        const scheduler = require('../src/core/scheduler')
        const result = scheduler.toggleSchedule(id)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
      }
    }
  )
}

module.exports = { registerCoreTools }
