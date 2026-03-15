## Cache-Bust Static Files with ver2

Run ver2 cache-busting on a project's static HTML files. Scans HTML for `src="..."` and `href="..."` references to static assets (.js, .css, .png, etc.), computes MD5 content hash, and adds/updates `?v={hash}` query params.

**Argument**: `$ARGUMENTS` — project ID (e.g. `pokkit`, `rawtxt`) or a directory path.

### Steps

1. **Resolve target**: If argument matches a known project ID, use `projects/{id}/public`. If it's a path, use it directly.

2. **Run ver2**:
   ```bash
   npx ver2-cli <target_path>
   ```

3. **Report results**: Show which files were updated and how many references were hashed.

### Options

Add flags after the project ID:

- `--dry-run` — Preview changes without writing
- `--strip /static/` — Strip URL prefix before resolving (for Fastify/Express static serving)
- `--length 12` — Custom hash length (default: 8)

### Examples

```
/ver2 pokkit                    # Hash all static refs in projects/pokkit/public/
/ver2 pokkit --dry-run          # Preview only
/ver2 pokkit --strip /static/   # Strip /static/ prefix
/ver2 C:\path\to\project        # Direct path
```

### For Runtime Templates

If the project generates HTML at runtime (like Pokkit's download page), ver2 CLI won't help. Instead, compute hash at server startup:

```typescript
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const cssHash = createHash('md5')
  .update(readFileSync('./public/style.css'))
  .digest('hex')
  .substring(0, 8)

// Use in template: `/style.css?v=${cssHash}`
```

### Which CloudPipe Projects Should Use ver2

| Project | Static HTML? | Needs ver2? | Notes |
|---------|-------------|-------------|-------|
| Pokkit | Yes (index.html) | Already integrated | Runtime template uses crypto hash |
| RawTxt | Yes | Candidate | |
| Quickky | Yes | Candidate | |
| MySpeedTest | Yes | Candidate | |
| AdMan | Next.js | No | Next.js handles hashing |
| MeeTube | Yes | Candidate | |
