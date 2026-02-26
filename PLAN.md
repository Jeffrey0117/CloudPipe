# MCP Auto-Discovery Implementation Plan

## Goal
讓 CloudPipe MCP Server 自動發現所有部署專案的 API endpoints，零配置生成 MCP tools。

## Architecture

### 1. Manifest Schema (`/api/manifest.json`)
每個專案提供標準 manifest 暴露 API：

```json
{
  "name": "project-name",
  "version": "1.0.0",
  "description": "Project description",
  "endpoints": [
    {
      "name": "operation_name",
      "description": "What this endpoint does",
      "method": "POST|GET|PUT|DELETE",
      "path": "/api/path",
      "auth": "bearer|none",
      "parameters": { /* JSON Schema */ },
      "response": { /* JSON Schema */ }
    }
  ]
}
```

### 2. OpenAPI Support (`/openapi.json`)
For FastAPI projects (like reelscript), auto-convert OpenAPI spec to MCP tools.

**Conversion:**
- `operationId` → tool name
- `summary` → tool description
- `requestBody` → parameters schema
- `responses.200` → response schema

### 3. Discovery Engine (`mcp/discovery.js`)

**Responsibilities:**
- Fetch all projects from CloudPipe API
- Try `/api/manifest.json` first, fallback to `/openapi.json`
- Parse and normalize to unified tool schema
- Handle authentication (bearer tokens, API keys)

**Key Methods:**
```javascript
class McpDiscovery {
  async discoverAll()           // Main entry point
  async fetchManifest(baseUrl)  // GET /api/manifest.json
  async fetchOpenAPI(baseUrl)   // GET /openapi.json
  parseManifest(project, data)  // manifest.json → tools
  parseOpenAPI(project, data)   // openapi.json → tools
}
```

### 4. Updated MCP Server (`mcp/index.js`)

**Startup Flow:**
1. Register core CloudPipe tools (list_projects, deploy, restart, etc.)
2. Run discovery engine to find all project APIs
3. Dynamically register tools for each discovered endpoint
4. Start MCP server on stdio

**Tool Naming Convention:**
`{project_id}_{operation_name}`

Examples:
- `autocard_generate_content`
- `autocard_list_pool`
- `reelscript_list_videos`
- `reelscript_generate_video`

### 5. Authentication Handling

**Per-Project Auth:**
- Each project may have own auth (JWT, API key, etc.)
- Store auth credentials in CloudPipe config
- Auto-inject auth headers when calling discovered endpoints

**Config Schema (data/mcp-auth.json):**
```json
{
  "autocard": {
    "type": "bearer",
    "token": "xxx"
  },
  "reelscript": {
    "type": "none"
  }
}
```

---

## Implementation Steps

### Phase 1: Manifest Schema & Discovery Engine
1. ✅ Define manifest.json schema (documented above)
2. Create `mcp/discovery.js`:
   - `McpDiscovery` class with `discoverAll()` method
   - `fetchManifest()` - try `/api/manifest.json`
   - `fetchOpenAPI()` - fallback to `/openapi.json`
   - `parseManifest()` - convert manifest to tool schema
   - `parseOpenAPI()` - convert OpenAPI to tool schema
3. Add unit tests for parser functions

### Phase 2: Update MCP Server
1. Refactor `mcp/index.js`:
   - Extract core CloudPipe tools to `mcp/core-tools.js`
   - Import and use `McpDiscovery`
   - Register discovered tools dynamically
2. Add health check logs (how many tools discovered)
3. Handle errors gracefully (projects down, invalid manifest)

### Phase 3: Add Manifests to Existing Projects
1. **AutoCard** (`projects/autocard/public/api/manifest.json`):
   - `/api/generate` - Generate flashcard content
   - `/api/suggest-topics` - AI topic suggestions
   - `/api/pool` - List content pool
   - `/api/pool/:id` - Get/Delete content
   - `/api/gemini` - Gemini AI operations

2. **ReelScript** (FastAPI already has `/openapi.json`):
   - Test OpenAPI parser with live backend
   - Verify tools like `list_videos`, `generate_video` work

3. **LetMeUse** (Next.js):
   - Add `public/api/manifest.json`
   - Document API endpoints

### Phase 4: Authentication Support
1. Create `data/mcp-auth.json` config
2. Add auth middleware in discovery engine
3. Support bearer tokens, API keys
4. Handle token refresh if needed

### Phase 5: Testing & Documentation
1. Test with all 5 projects (reelscript, letmeuse, autocard, adman, claudebot)
2. Verify Claude Code can discover and use tools
3. Write README for adding manifest to new projects
4. Update CloudPipe docs

---

## File Structure

```
cloudpipe/
├── mcp/
│   ├── index.js           # Main MCP server (refactored)
│   ├── discovery.js       # Auto-discovery engine (NEW)
│   ├── core-tools.js      # Core CloudPipe tools (extracted)
│   └── package.json
├── projects/
│   ├── autocard/
│   │   └── public/api/manifest.json   # NEW
│   ├── letmeuse/
│   │   └── public/api/manifest.json   # NEW
│   └── reelscript/
│       └── (uses /openapi.json from FastAPI)
├── data/
│   └── mcp-auth.json      # Auth config for discovered projects (NEW)
└── README-MCP.md          # Developer guide (NEW)
```

---

## Benefits

1. **Zero Configuration** - New projects auto-appear in MCP
2. **Self-Documenting** - manifest.json = API contract + MCP tools
3. **FastAPI Support** - Leverage existing OpenAPI specs
4. **Extensible** - Easy to add new manifest formats
5. **Claude-Friendly** - All project APIs accessible via natural language

---

## Success Criteria

- ✅ Deploy a new project with manifest.json
- ✅ Restart CloudPipe MCP server
- ✅ See new tools appear in Claude Code
- ✅ Use tools via natural language ("generate an autocard about TypeScript")
- ✅ No manual MCP tool registration needed

---

## Example Usage (After Implementation)

```
User: "Generate a flashcard about React hooks using autocard"
Claude: [Uses autocard_generate_content tool automatically]

User: "List all my reelscript videos"
Claude: [Uses reelscript_list_videos tool automatically]
```

All tools discovered from manifest files, zero manual config! 🎉
