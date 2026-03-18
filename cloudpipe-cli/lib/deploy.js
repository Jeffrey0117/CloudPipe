import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { execSync } from 'node:child_process';

/**
 * Pack outputDir into tar.gz and upload to server.
 * Returns { url, slug, size } from server response.
 */
export async function deploy({ outputDir, slug, token, server }) {
  // Validate index.html exists
  if (!fs.existsSync(path.join(outputDir, 'index.html'))) {
    throw new Error(`No index.html found in ${outputDir}`);
  }

  // Create tar.gz
  const tmpFile = path.join(os.tmpdir(), `cloudpipe-${slug}-${Date.now()}.tar.gz`);

  try {
    execSync(`tar czf "${tmpFile}" -C "${outputDir}" .`, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      'Failed to create archive. Make sure `tar` is available.\n' +
      (err.stderr?.toString() || err.message)
    );
  }

  const archiveBuffer = fs.readFileSync(tmpFile);

  // Cleanup temp file
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

  // Check size
  const sizeMB = (archiveBuffer.length / (1024 * 1024)).toFixed(1);
  if (archiveBuffer.length > 50 * 1024 * 1024) {
    throw new Error(`Archive too large: ${sizeMB} MB (limit: 50 MB)`);
  }

  console.log(`Uploading ${sizeMB} MB...`);

  // Upload
  const url = new URL(`/api/deploy/static?slug=${encodeURIComponent(slug)}`, server);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/gzip',
        'content-length': archiveBuffer.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(data.error || `Server returned ${res.statusCode}`));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Server returned ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(archiveBuffer);
    req.end();
  });
}
