import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import type { SetupProgress, SetupStep } from '@shared/types';

// .vite/build/ → desktop/ → cloudpipe/
const CLOUDPIPE_ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(CLOUDPIPE_ROOT, 'config.json');

type ProgressCallback = (progress: SetupProgress) => void;

function isValidProjectId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length < 100;
}

function findCloudflared(): string | null {
  const candidates = [
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    path.join(process.env.USERPROFILE || '', 'cloudflared.exe'),
    path.join(process.env.USERPROFILE || '', '.cloudflared', 'cloudflared.exe'),
  ];

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = execFileSync(cmd, ['cloudflared'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim().split('\n')[0].trim();
    return result || null;
  } catch {
    return candidates.find((p) => fs.existsSync(p)) || null;
  }
}

function installCloudflared(): string | null {
  try {
    if (process.platform === 'win32') {
      execFileSync('winget', [
        'install', 'cloudflare.cloudflared',
        '--accept-source-agreements', '--accept-package-agreements',
      ], { stdio: 'pipe', windowsHide: true, timeout: 120_000 });
    } else {
      execFileSync('sh', [
        '-c',
        'curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared',
      ], { stdio: 'pipe', timeout: 120_000 });
    }
    return findCloudflared();
  } catch {
    return null;
  }
}

interface BundleProject {
  id: string;
  port?: number;
  customDomains?: string[];
}

interface SetupBundle {
  tunnelId?: string;
  tunnelCredentials?: Record<string, unknown>;
  domain?: string;
  subdomain?: string;
  port?: number;
  adminPassword?: string;
  jwtSecret?: string;
  serviceToken?: string;
  redis?: { url: string };
  telegramProxy?: string;
  telegram?: Record<string, unknown>;
  projects?: BundleProject[];
  error?: string;
}

function generateCloudflaredYml(bundle: SetupBundle, credentialsFile: string): string {
  const lines: string[] = [];
  lines.push(`tunnel: ${bundle.tunnelId}`);
  lines.push(`credentials-file: ${credentialsFile}`);
  lines.push('');
  lines.push('ingress:');

  const domain = bundle.domain || 'localhost';
  const subdomain = bundle.subdomain || 'epi';

  lines.push(`  - hostname: "${subdomain}.${domain}"`);
  lines.push(`    service: http://localhost:${bundle.port || 8787}`);

  const projects = bundle.projects || [];
  for (const proj of projects) {
    if (!proj.port) continue;
    lines.push(`  - hostname: "${proj.id}.${domain}"`);
    lines.push(`    service: http://localhost:${proj.port}`);

    if (Array.isArray(proj.customDomains)) {
      for (const cd of proj.customDomains) {
        lines.push(`  - hostname: "${cd}"`);
        lines.push(`    service: http://localhost:${proj.port}`);
      }
    }
  }

  lines.push(`  - hostname: "*.${domain}"`);
  lines.push(`    service: http://localhost:${bundle.port || 8787}`);
  lines.push('  - service: http_status:404');
  lines.push('');

  return lines.join('\n');
}

export class SetupService {
  needsSetup(): boolean {
    return !fs.existsSync(CONFIG_PATH);
  }

  async run(
    serverUrl: string,
    password: string,
    onProgress: ProgressCallback,
  ): Promise<{ success: boolean; error?: string }> {
    const emit = (step: SetupStep, message: string, error?: string): void => {
      onProgress({ step, message, error });
    };

    const normalizedUrl = serverUrl.trim().replace(/\/+$/, '');

    try {
      const parsedUrl = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        emit('failed', 'Invalid URL', 'Server URL must use http:// or https://');
        return { success: false, error: 'Invalid URL protocol' };
      }
    } catch {
      emit('failed', 'Invalid URL', 'Please enter a valid URL');
      return { success: false, error: 'Invalid URL format' };
    }

    try {
      // [1] Login
      emit('login', 'Authenticating...');
      const loginRes = await fetch(`${normalizedUrl}/api/_admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const loginData = await loginRes.json() as { success?: boolean; token?: string; error?: string };
      if (!loginData.success || !loginData.token) {
        emit('failed', 'Login failed', loginData.error || 'Wrong password');
        return { success: false, error: loginData.error || 'Wrong password' };
      }
      const token = loginData.token;

      // [2] Download bundle
      emit('bundle', 'Downloading config bundle...');
      const bundleRes = await fetch(`${normalizedUrl}/api/_admin/setup-bundle`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bundle = await bundleRes.json() as SetupBundle;
      if (bundle.error) {
        emit('failed', 'Bundle download failed', bundle.error);
        return { success: false, error: bundle.error };
      }

      // [3] Find/install cloudflared
      emit('cloudflared', 'Checking cloudflared...');
      let cfPath = findCloudflared();
      if (!cfPath) {
        emit('cloudflared', 'Installing cloudflared...');
        cfPath = installCloudflared();
      }
      if (!cfPath) {
        emit('failed', 'cloudflared not found', 'Please install cloudflared manually and retry');
        return { success: false, error: 'cloudflared not found' };
      }

      // [4] Write tunnel credentials
      emit('credentials', 'Writing tunnel credentials...');
      let credentialsFile = '';
      if (bundle.tunnelCredentials && bundle.tunnelId) {
        const cfDir = path.join(
          process.env.USERPROFILE || process.env.HOME || os.homedir(),
          '.cloudflared',
        );
        if (!fs.existsSync(cfDir)) {
          fs.mkdirSync(cfDir, { recursive: true });
        }
        credentialsFile = path.join(cfDir, `${bundle.tunnelId}.json`);
        fs.writeFileSync(credentialsFile, JSON.stringify(bundle.tunnelCredentials, null, 2));
      }

      // [5] Write config.json
      emit('config', 'Writing config.json...');
      const machineId = `${os.hostname().toLowerCase()}-${Date.now().toString(36).slice(-4)}`;

      const telegramConfig = {
        ...(bundle.telegram || { enabled: false, botToken: '', chatId: '' }),
        polling: false,
      };

      const config = {
        machineId,
        domain: bundle.domain,
        port: bundle.port,
        subdomain: bundle.subdomain,
        adminPassword: bundle.adminPassword,
        jwtSecret: bundle.jwtSecret,
        serviceToken: bundle.serviceToken || '',
        redis: bundle.redis || { url: '' },
        telegramProxy: bundle.telegramProxy || '',
        supabase: { url: '', anonKey: '', serviceRoleKey: '', logRequests: false },
        cloudflared: {
          path: cfPath,
          tunnelId: bundle.tunnelId,
          credentialsFile,
        },
        telegram: telegramConfig,
      };

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      // [6] Generate cloudflared.yml
      emit('tunnel_yml', 'Generating cloudflared.yml...');
      if (bundle.tunnelId) {
        const ymlContent = generateCloudflaredYml(bundle, credentialsFile);
        const ymlPath = path.join(CLOUDPIPE_ROOT, 'cloudflared.yml');
        fs.writeFileSync(ymlPath, ymlContent);
      }

      // [7] Sync projects.json
      emit('projects', 'Syncing projects...');
      if (bundle.projects && bundle.projects.length > 0) {
        const deployDir = path.join(CLOUDPIPE_ROOT, 'data', 'deploy');
        if (!fs.existsSync(deployDir)) {
          fs.mkdirSync(deployDir, { recursive: true });
        }
        const projectsPath = path.join(deployDir, 'projects.json');
        fs.writeFileSync(projectsPath, JSON.stringify({ projects: bundle.projects }, null, 2));
      }

      // [8] Pull .env files
      emit('env', 'Pulling .env files...');
      try {
        const envRes = await fetch(`${normalizedUrl}/api/_admin/env-bundle/direct`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const envData = await envRes.json() as { error?: string; envBundle?: Record<string, string> };

        if (envData.envBundle) {
          for (const [projectId, envContent] of Object.entries(envData.envBundle)) {
            if (!isValidProjectId(projectId)) continue;
            if (typeof envContent !== 'string' || envContent.length > 100_000) continue;
            const envDir = path.join(CLOUDPIPE_ROOT, 'projects', projectId);
            if (!fs.existsSync(envDir)) {
              fs.mkdirSync(envDir, { recursive: true });
            }
            fs.writeFileSync(path.join(envDir, '.env'), envContent);
          }
        }
      } catch (err) {
        // Non-fatal: .env pull can fail, setup continues
        console.warn('.env pull failed:', (err as Error).message);
      }

      emit('complete', 'Setup complete!');
      return { success: true };
    } catch (err) {
      const errorMsg = (err as Error).message;
      emit('failed', 'Setup failed', errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}
