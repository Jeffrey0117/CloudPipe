const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const ProjectDetector = require('../utils/ProjectDetector');
const ServiceManager = require('../utils/ServiceManager');
const TunnelManager = require('../utils/TunnelManager');

module.exports = async function deploy(projectPath, options) {
  const targetPath = path.resolve(process.cwd(), projectPath || '.');
  const configPath = path.join(targetPath, 'cloudpipe.json');

  console.log(chalk.cyan(`🚀 部署專案: ${chalk.bold(path.basename(targetPath))}\n`));

  let config;
  let spinner;

  try {
    // 1. 讀取或自動偵測配置
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(chalk.dim('使用配置: cloudpipe.json\n'));
    } else {
      spinner = ora('自動偵測專案類型...').start();
      const detector = new ProjectDetector(targetPath);
      const projectInfo = await detector.detect();

      config = {
        name: options.name || path.basename(targetPath),
        type: projectInfo.type,
        framework: projectInfo.framework,
        buildCommand: projectInfo.buildCommand,
        startCommand: projectInfo.startCommand,
        port: options.port || projectInfo.port,
        env: {},
        tunnel: {
          enabled: options.tunnel !== false
        }
      };

      spinner.succeed(`偵測到: ${chalk.cyan(projectInfo.type)}`);
      console.log('');
    }

    // 2. 執行建置（如果有）
    if (config.buildCommand) {
      spinner = ora('執行建置...').start();
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec(config.buildCommand, { cwd: targetPath }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      spinner.succeed('建置完成');
    }

    // 3. 啟動服務
    spinner = ora('啟動服務...').start();
    const serviceManager = new ServiceManager();
    const service = await serviceManager.start({
      name: config.name,
      cwd: targetPath,
      script: config.startCommand,
      port: config.port,
      env: config.env
    });
    spinner.succeed(`服務已啟動 (Port: ${chalk.yellow(config.port)})`);

    // 4. 建立 Tunnel（如果啟用）
    let publicUrl = `http://localhost:${config.port}`;

    if (config.tunnel && config.tunnel.enabled) {
      spinner = ora('建立 Cloudflare Tunnel...').start();
      const tunnelManager = new TunnelManager();
      const tunnel = await tunnelManager.create(config.name, config.port);
      publicUrl = tunnel.url;
      spinner.succeed(`Tunnel 已建立`);
    }

    // 5. 完成
    console.log('');
    console.log(chalk.green.bold('✓ 部署成功！\n'));
    console.log(chalk.bold('專案資訊：'));
    console.log(`  名稱: ${chalk.cyan(config.name)}`);
    console.log(`  本地: ${chalk.yellow(`http://localhost:${config.port}`)}`);
    if (publicUrl !== `http://localhost:${config.port}`) {
      console.log(`  公開: ${chalk.green(publicUrl)}`);
    }
    console.log('');
    console.log(chalk.dim('管理指令：'));
    console.log(chalk.dim(`  cloudpipe logs ${config.name}     # 查看日誌`));
    console.log(chalk.dim(`  cloudpipe stop ${config.name}     # 停止服務`));
    console.log(chalk.dim(`  cloudpipe remove ${config.name}   # 移除部署`));
    console.log('');

  } catch (error) {
    if (spinner) spinner.fail('部署失敗');
    console.error(chalk.red('✗ 錯誤:'), error.message);
    process.exit(1);
  }
};
