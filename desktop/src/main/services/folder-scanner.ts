import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import type { FolderScanResult } from '@shared/types';

function gitExec(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: 5_000, shell: true }, (err, stdout) => {
      if (err) {
        resolve('');
        return;
      }
      resolve(stdout.toString().trim());
    });
  });
}

function detectEntryFile(dir: string, pkgMain?: string): string {
  const candidates = [
    'server.js',
    'index.js',
    'src/index.js',
    'src/server.js',
    'app.js',
  ];

  if (pkgMain) {
    candidates.unshift(pkgMain);
  }

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(dir, candidate))) {
      return candidate;
    }
  }

  return 'index.js';
}

function detectPackageManager(dir: string): 'pnpm' | 'yarn' | 'npm' {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export async function scanWorkspace(workspacePath: string): Promise<FolderScanResult[]> {
  const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules');

  // Filter to project dirs, then scan ALL in parallel
  const projectDirs = dirs.filter((dir) => {
    const fullPath = path.join(workspacePath, dir.name);
    return fs.existsSync(path.join(fullPath, 'package.json'))
      || fs.existsSync(path.join(fullPath, '.git'));
  });

  const results = await Promise.all(
    projectDirs.map(async (dir) => {
      const fullPath = path.join(workspacePath, dir.name);
      const result = await scanFolder(fullPath);
      return { ...result, folderPath: fullPath };
    }),
  );

  return results;
}

export async function scanFolder(folderPath: string): Promise<FolderScanResult> {
  let name = path.basename(folderPath);
  let entryFile = 'index.js';
  let buildCommand = '';
  let pkgMain: string | undefined;

  const pkgPath = path.join(folderPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      if (pkg.name) name = pkg.name.replace(/^@[^/]+\//, '');
      if (pkg.main) pkgMain = pkg.main;
      if (pkg.scripts?.build) {
        const pm = detectPackageManager(folderPath);
        buildCommand = `${pm} run build`;
      }
    } catch { /* ignore malformed package.json */ }
  }

  entryFile = detectEntryFile(folderPath, pkgMain);
  const packageManager = detectPackageManager(folderPath);

  const repoUrl = await gitExec(['remote', 'get-url', 'origin'], folderPath);
  const branch = await gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], folderPath);
  const hasGit = repoUrl.length > 0;

  return {
    name,
    entryFile,
    buildCommand,
    repoUrl,
    branch: branch || 'main',
    packageManager,
    hasGit,
  };
}
