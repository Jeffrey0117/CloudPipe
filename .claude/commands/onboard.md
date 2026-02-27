## Onboard a New Project to CloudPipe

The user wants to onboard a project into CloudPipe's ecosystem (gateway + MCP + bot + pipeline).

**Argument**: `$ARGUMENTS` — project name or path to scan.

### Steps

1. **Find the project**: Locate the project folder (check `projects/`, `C:\Users\jeffb\Desktop\code\`, or the path given). Read its package.json, entry files, and route definitions.

2. **Scan API routes**: Find all HTTP endpoints the project exposes. Check:
   - Express routes (`app.get`, `app.post`, `router.get`, etc.)
   - FastAPI routes (`@app.get`, `@router.post`, etc.)
   - Raw Node http handlers
   - Existing manifest or OpenAPI spec

3. **Check for HTTP server**: If the project has no HTTP server (e.g., it's only a CLI tool or Telegram bot):
   - Create `server.js` with Node's built-in `http` module
   - Expose the core functions as POST/GET endpoints
   - Add `GET /api/health` health check
   - Use `process.env.PORT || <next_available_port>`

4. **Write manifest**: Create `data/manifests/{projectId}.json` following the spec in CLAUDE.md. Rules:
   - Only include endpoints useful for gateway/pipeline (skip admin-only, file-upload-only)
   - Use snake_case for endpoint names
   - Include parameter descriptions
   - Mark auth requirements

5. **Update auth.json**: Add the project to `data/manifests/auth.json`. Ask the user what auth type to use if unclear:
   - `"type": "none"` — no auth needed
   - `"type": "bearer", "token": "..."` — hardcoded token
   - `"type": "bearer", "env": "VAR_NAME"` — from environment variable

6. **Check project registration**: Verify if the project exists in `data/deploy/projects.json`. If not, inform the user they need to register it via admin UI or provide the details (repo URL, port, entry file, build command).

7. **Verify port assignment**: Check `data/deploy/projects.json` for existing port allocations. Suggest the next available port if needed. Current range: 4001-4009.

8. **Summary**: Report what was created/modified and what the user needs to do next (register the project, deploy, restart CloudPipe).
