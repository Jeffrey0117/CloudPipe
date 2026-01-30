const chalk = require('chalk');
const Table = require('cli-table3');
const ServiceManager = require('../utils/ServiceManager');

module.exports = async function list() {
  console.log(chalk.cyan('📋 部署清單\n'));

  try {
    const serviceManager = new ServiceManager();
    const services = await serviceManager.list();

    if (services.length === 0) {
      console.log(chalk.yellow('沒有運行中的專案'));
      console.log(chalk.dim('\n使用 cloudpipe deploy 開始部署'));
      return;
    }

    const table = new Table({
      head: ['名稱', '狀態', '端口', 'PID', '運行時間', '重啟次數'].map(h => chalk.cyan(h)),
      style: { head: [], border: [] }
    });

    services.forEach(service => {
      const status = service.status === 'online'
        ? chalk.green('●') + ' online'
        : chalk.red('●') + ' stopped';

      table.push([
        chalk.bold(service.name),
        status,
        chalk.yellow(service.port || 'N/A'),
        chalk.dim(service.pid || 'N/A'),
        service.uptime || 'N/A',
        service.restarts || '0'
      ]);
    });

    console.log(table.toString());
    console.log('');

  } catch (error) {
    console.error(chalk.red('✗ 錯誤:'), error.message);
    process.exit(1);
  }
};
