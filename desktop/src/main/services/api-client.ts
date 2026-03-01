import http from 'http';
import https from 'https';
import { URL } from 'url';

export class ApiClient {
  private serverUrl: string;
  private token: string;

  constructor(serverUrl: string, token: string) {
    this.serverUrl = serverUrl || 'http://localhost:8787';
    this.token = token || '';
  }

  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
    const url = new URL(path, this.serverUrl);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Host': url.host,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    // Force IPv6 loopback for localhost (CloudPipe router needs correct Host header)
    const hostname = url.hostname === 'localhost' ? '::1' : url.hostname;

    return new Promise((resolve, reject) => {
      const req = mod.request(
        {
          hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers,
          family: url.hostname === 'localhost' ? 6 : undefined,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              resolve(data as unknown as T);
            }
          });
        },
      );

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Request timeout'));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }

  // --- Auth ---
  async login(password: string): Promise<{ token: string }> {
    return this.request('POST', '/api/_admin/login', { password });
  }

  async verifyToken(): Promise<{ valid: boolean }> {
    return this.request('GET', '/api/_admin/verify');
  }

  // --- Projects ---
  async getProjects(): Promise<unknown[]> {
    const res = await this.request<{ projects?: unknown[] }>('GET', '/api/_admin/deploy/projects');
    return res.projects || [];
  }

  async deployProject(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request('POST', `/api/_admin/deploy/projects/${id}/deploy`);
  }

  async deployProjectSync(id: string): Promise<{ success: boolean; error?: string; deployment?: unknown }> {
    return this.request('POST', `/api/_admin/deploy/projects/${id}/deploy?sync=true`, undefined, 5 * 60_000);
  }

  async restartProject(id: string): Promise<{ success: boolean; error?: string }> {
    return this.request('POST', `/api/_admin/deploy/projects/${id}/restart`);
  }

  async getDeployHistory(_id?: string): Promise<unknown[]> {
    // CloudPipe embeds deploy info in project data, extract from projects list
    const projects = await this.getProjects();
    return (projects as Array<Record<string, unknown>>)
      .filter((p) => p.lastDeployAt)
      .map((p) => ({
        id: `${p.id}-${p.lastDeployAt}`,
        projectId: p.id,
        status: p.lastDeployStatus || 'unknown',
        commit: p.lastDeployCommit || p.runningCommit,
        timestamp: new Date(p.lastDeployAt as string).getTime(),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // --- Register project ---
  async registerProject(data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    return this.request('POST', '/api/_admin/deploy/projects', data);
  }

  // --- Logs ---
  async getLogs(pm2Name: string): Promise<{ stdout: string; stderr: string }> {
    return this.request('GET', `/api/_admin/deploy/logs/${pm2Name}`);
  }

  // --- System ---
  async getSystemInfo(): Promise<unknown> {
    return this.request('GET', '/api/_admin/system');
  }

  // --- Gateway ---
  async getTools(): Promise<unknown[]> {
    const res = await this.request<{ tools?: unknown[] }>('GET', '/api/gateway/tools');
    return res.tools || [];
  }

  async getPipelines(): Promise<unknown[]> {
    const res = await this.request<{ pipelines?: unknown[] }>('GET', '/api/gateway/pipelines');
    return res.pipelines || [];
  }

  async callTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/api/gateway/call', { tool, params });
  }

  async runPipeline(pipeline: string, input: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/api/gateway/pipeline', { pipeline, input });
  }
}
