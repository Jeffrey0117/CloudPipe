/**
 * CLOUDPIPE 入口點
 * 執行：node index.js
 */

// 手動載入 services/.env
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, 'services', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('[cloudpipe] 已載入 services/.env');
}

require('./src/core/server');
