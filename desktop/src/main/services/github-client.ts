import https from 'https';
import type { GitHubUser, GitHubRepo } from '@shared/types';

function ghRequest<T>(path: string, pat?: string): Promise<T> {
  const headers: Record<string, string> = {
    'User-Agent': 'CloudPipe-Desktop',
    'Accept': 'application/vnd.github+json',
  };
  if (pat) {
    headers['Authorization'] = `Bearer ${pat}`;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Failed to parse GitHub response: ${data}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('GitHub API timeout'));
    });
    req.end();
  });
}

function mapRepo(r: GitHubRepo): GitHubRepo {
  return {
    full_name: r.full_name,
    name: r.name,
    description: r.description || '',
    private: r.private,
    default_branch: r.default_branch,
    language: r.language || '',
    clone_url: r.clone_url,
    html_url: r.html_url,
    updated_at: r.updated_at,
  };
}

export async function validateToken(pat: string): Promise<GitHubUser> {
  const user = await ghRequest<{ login: string; name: string | null }>('/user', pat);
  return { login: user.login, name: user.name || user.login };
}

export async function getRepos(pat: string): Promise<GitHubRepo[]> {
  const repos = await ghRequest<GitHubRepo[]>('/user/repos?per_page=100&sort=updated', pat);
  return repos.map(mapRepo);
}

export async function searchRepos(query: string, pat?: string): Promise<GitHubRepo[]> {
  const encoded = encodeURIComponent(`${query} in:name`);
  const res = await ghRequest<{ items: GitHubRepo[] }>(
    `/search/repositories?q=${encoded}&sort=best-match&per_page=30`,
    pat,
  );
  return (res.items || []).map(mapRepo);
}

export async function getStarred(pat: string): Promise<GitHubRepo[]> {
  const repos = await ghRequest<GitHubRepo[]>('/user/starred?per_page=100&sort=updated', pat);
  return repos.map(mapRepo);
}
