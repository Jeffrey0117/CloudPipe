/**
 * CLOUDPIPE - API Tunnel Service
 * 主程式入口
 */

const path = require('path');
const ServiceRegistry = require('./registry');
const deploy = require('./deploy');
const telegram = require('./telegram');

// 專案根目錄
const rootDir = path.join(__dirname, '..', '..');

// 建立服務註冊中心
const registry = new ServiceRegistry();

// 載入設定
const configPath = path.join(rootDir, 'config.json');
registry.loadConfig(configPath);

console.log('');
console.log('========================================');
console.log('  CLOUDPIPE - Local Deploy Gateway');
console.log('========================================');
console.log('');

// 掃描服務 (services/*.js)
const servicesDir = path.join(rootDir, 'services');
registry.scanServices(servicesDir);

// 啟動所有服務
if (!registry.startAll()) {
  console.log('    Drop a .js file in services/ directory');
  process.exit(1);
}

// 啟動 GitHub 輪詢（Backup 機制，每 5 分鐘）
deploy.startPolling(5 * 60 * 1000);

// 啟動 Telegram Bot（respect polling flag）
const tgConfig = telegram.getConfig();
if (tgConfig.polling !== false) {
  telegram.startBot();
} else {
  console.log('[Telegram] polling=false, notification-only mode');
  telegram.startNotificationsOnly();
}

// XCard Bot: optional loading from config
let xcardBot = null;
const xcardConfig = registry.config?.xcard;
if (xcardConfig?.enabled && xcardConfig?.botPath) {
  try {
    xcardBot = require(xcardConfig.botPath);
    xcardBot.startBot(xcardConfig);
  } catch (e) {
    console.log('[XCard] Bot not found, skipping:', e.message);
  }
} else {
  console.log('[XCard] Not enabled or no botPath, skipping');
}

// Graceful shutdown
const shutdown = async () => {
  console.log('');
  console.log('[*] Shutting down...');

  try {
    deploy.stopPolling();
    telegram.stopBot();
    if (xcardBot) xcardBot.stopBot();

    // 等待伺服器完全關閉（給 3 秒時間）
    registry.stopAll();

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('[*] Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[*] Shutdown error:', err);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught exceptions to prevent crash loops
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  // Don't exit immediately, let the process continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, let the process continue
});

console.log('----------------------------------------');
console.log('Press Ctrl+C to stop all services');
console.log('----------------------------------------');
console.log('');

// Export for external use
module.exports = registry;
