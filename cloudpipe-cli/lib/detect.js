import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Detect project type and build if needed.
 * Returns { outputDir, suggestedSlug } or throws with user-friendly message.
 */
export function detectAndBuild(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  const indexPath = path.join(cwd, 'index.html');

  // Case 1: has package.json with build script
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    // Reject Next.js SSR
    const hasNextConfig = ['next.config.js', 'next.config.mjs', 'next.config.ts']
      .some(f => fs.existsSync(path.join(cwd, f)));
    if (hasNextConfig) {
      throw new Error(
        'Next.js SSR needs a Pro plan.\n' +
        'For static export, add `output: "export"` to next.config.js, then retry.'
      );
    }

    if (pkg.scripts?.build) {
      console.log('Building project...');
      execSync('npm run build', { cwd, stdio: 'inherit' });

      // Detect output directory (dist first for Vite, then build, out)
      const candidates = ['dist', 'build', 'out'];

      for (const dir of candidates) {
        const outputDir = path.join(cwd, dir);
        if (fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory()) {
          return { outputDir, suggestedSlug: slugify(pkg.name || path.basename(cwd)) };
        }
      }

      throw new Error(
        `Build succeeded but no output directory found.\n` +
        `Looked for: ${candidates.join(', ')}`
      );
    }

    // Has package.json but no build script — check for index.html
    if (fs.existsSync(indexPath)) {
      return { outputDir: cwd, suggestedSlug: slugify(pkg.name || path.basename(cwd)) };
    }

    throw new Error(
      'package.json found but no "build" script and no index.html.\n' +
      'Add a build script or create an index.html.'
    );
  }

  // Case 2: plain HTML project
  if (fs.existsSync(indexPath)) {
    return { outputDir: cwd, suggestedSlug: slugify(path.basename(cwd)) };
  }

  // Case 3: nothing deployable
  throw new Error(
    'No deployable files found.\n' +
    'Need index.html or package.json with a build script.'
  );
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, '')    // strip npm scope
    .replace(/[^a-z0-9-]/g, '-') // non-alphanum → hyphen
    .replace(/-+/g, '-')          // collapse hyphens
    .replace(/^-|-$/g, '')        // trim hyphens
    .slice(0, 50)
    || 'my-site';
}
