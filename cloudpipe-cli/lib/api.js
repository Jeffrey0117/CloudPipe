import https from 'node:https';
import http from 'node:http';

function request(method, urlStr, { token, body } = {}) {
  const url = new URL(urlStr);
  const transport = url.protocol === 'https:' ? https : http;

  const headers = {
    'authorization': `Bearer ${token}`,
  };

  if (body) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(data.error || `Server returned ${res.statusCode}`));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Server returned ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function listSites({ token, server }) {
  return request('GET', `${server}/api/sites`, { token });
}

export async function deleteSite({ slug, token, server }) {
  return request('DELETE', `${server}/api/sites/${encodeURIComponent(slug)}`, { token });
}
