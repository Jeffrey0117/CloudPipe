const chalk = require('chalk');
const Table = require('cli-table3');
const DeployHistory = require('../utils/DeployHistory');

/**
 * cloudpipe history 指令
 */
function history(options) {
  const deployHistory = new DeployHistory();
  const limit = parseInt(options.limit) || 10;
  const recent = deployHistory.getRecent(limit);

  if (recent.length === 0) {
    console.log(chalk.yellow('沒有部署歷史'));
    console.log(chalk.dim('\n使用 cloudpipe deploy 開始部署'));
    return;
  }

  console.log(chalk.cyan(`📜 最近 ${recent.length} 筆部署\n`));

  const table = new Table({
    head: ['ID', '時間', '專案', '類型', 'URL', '狀態'].map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
    colWidths: [10, 20, 15, 12, 40, 10]
  });

  recent.forEach(entry => {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const status = entry.status === 'success'
      ? chalk.green('✓')
      : chalk.red('✗');

    const url = entry.url
      ? (entry.url.length > 35 ? entry.url.substr(0, 35) + '...' : entry.url)
      : chalk.dim('N/A');

    table.push([
      chalk.dim(entry.id),
      timeStr,
      chalk.bold(entry.name),
      entry.framework || entry.type || chalk.dim('unknown'),
      url,
      status
    ]);
  });

  console.log(table.toString());
  console.log('');

  // 顯示統計
  const stats = deployHistory.getStats();
  console.log(chalk.dim(`總計: ${stats.total} 次部署 (成功: ${stats.success}, 失敗: ${stats.failed})`));
  console.log('');
}

module.exports = history;
