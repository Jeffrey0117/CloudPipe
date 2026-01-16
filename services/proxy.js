/**
 * Proxy 路由 - 轉發到 Railway API
 */

const https = require('https');
const { URL } = require('url');

const TARGET = 'https://api-production-1ea7.up.railway.app';

module.exports = {
  // 匹配 /proxy/* 路徑
  match(req) {
    return req.url.startsWith('/proxy');
  },

  // 轉發請求（/proxy → /api）
  handle(req, res) {
    const path = req.url.replace(/^\/proxy/, '/api');
    const targetUrl = new URL(path, TARGET);

    console.log(`[proxy] ${req.url} -> ${targetUrl.href}`);

    // 只保留必要 headers
    const headers = {
      'host': targetUrl.hostname,
      'content-type': req.headers['content-type'] || 'application/json',
      'accept': 'application/json'
    };
    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'];
    }
    if (req.headers['content-length']) {
      headers['content-length'] = req.headers['content-length'];
    }

    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['content-encoding'];

      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy] Error:', err.message);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    });

    req.pipe(proxyReq);
  }
};
