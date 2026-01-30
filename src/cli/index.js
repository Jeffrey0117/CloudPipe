#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const packageJson = require('../../package.json');

const program = new Command();

// 設定 CLI 基本資訊
program
  .name('cloudpipe')
  .description('🚀 Zero-config deployment tool for full-stack apps')
  .version(packageJson.version);

// 載入指令
const initCommand = require('./commands/init');
const deployCommand = require('./commands/deploy');
const listCommand = require('./commands/list');
const stopCommand = require('./commands/stop');
const removeCommand = require('./commands/remove');
const logsCommand = require('./commands/logs');
const { envSet, envList, envRemove } = require('./commands/env');
const historyCommand = require('./commands/history');

// 註冊指令
program
  .command('init')
  .description('掃描專案並產生配置')
  .option('-f, --force', '強制覆寫現有配置')
  .action(initCommand);

program
  .command('deploy [path]')
  .description('一鍵部署專案')
  .option('-n, --name <name>', '指定專案名稱')
  .option('-p, --port <port>', '指定端口')
  .option('--no-tunnel', '不建立 Cloudflare tunnel')
  .option('-w, --watch', '監控檔案變動並自動重載')
  .action(deployCommand);

program
  .command('list')
  .alias('ls')
  .description('列出所有部署的專案')
  .action(listCommand);

program
  .command('stop <name>')
  .description('停止指定專案')
  .action(stopCommand);

program
  .command('remove <name>')
  .alias('rm')
  .description('移除指定專案')
  .action(removeCommand);

program
  .command('logs <name>')
  .description('查看專案日誌')
  .option('-f, --follow', '即時追蹤日誌')
  .option('-n, --lines <number>', '顯示最後 N 行', '50')
  .action(logsCommand);

// 環境變數管理
const envCommand = program.command('env <action> [key]');
envCommand.description('管理環境變數');

envCommand
  .command('set [keyValue]')
  .description('設定環境變數 (格式: KEY=VALUE)')
  .action(envSet);

envCommand
  .command('list')
  .alias('ls')
  .description('列出所有環境變數')
  .action(envList);

envCommand
  .command('remove <key>')
  .alias('rm')
  .description('移除環境變數')
  .action(envRemove);

program
  .command('history')
  .description('查看部署歷史')
  .option('-l, --limit <number>', '顯示筆數', '10')
  .action(historyCommand);

// 自訂 help
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ cloudpipe init              # 掃描當前專案');
  console.log('  $ cloudpipe deploy            # 部署當前專案');
  console.log('  $ cloudpipe deploy ./my-app   # 部署指定目錄');
  console.log('  $ cloudpipe list              # 列出所有部署');
  console.log('  $ cloudpipe logs my-app -f    # 即時查看日誌');
  console.log('');
});

// 解析參數
program.parse(process.argv);

// 如果沒有提供任何指令，顯示 help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
