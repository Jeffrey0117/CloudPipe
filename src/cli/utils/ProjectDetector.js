const fs = require('fs');
const path = require('path');

/**
 * 專案類型自動偵測引擎
 */
class ProjectDetector {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.packageJsonPath = path.join(projectPath, 'package.json');
  }

  /**
   * 偵測專案類型
   */
  async detect() {
    // 讀取 package.json
    let packageJson = {};
    if (fs.existsSync(this.packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // 偵測框架
    const framework = this.detectFramework(deps, packageJson);
    const type = this.detectType(framework, deps);

    // 產生配置
    const config = this.generateConfig(type, framework, packageJson);

    return {
      type,
      framework,
      ...config
    };
  }

  /**
   * 偵測框架
   */
  detectFramework(deps, packageJson) {
    if (deps['next']) return 'nextjs';
    if (deps['vite']) return 'vite';
    if (deps['@vitejs/plugin-react']) return 'vite-react';
    if (deps['@vitejs/plugin-vue']) return 'vite-vue';
    if (deps['react-scripts']) return 'create-react-app';
    if (deps['@angular/core']) return 'angular';
    if (deps['vue']) return 'vue';
    if (deps['express']) return 'express';
    if (deps['fastify']) return 'fastify';
    if (deps['koa']) return 'koa';

    // 檢查 scripts
    if (packageJson.scripts) {
      if (packageJson.scripts.dev?.includes('vite')) return 'vite';
      if (packageJson.scripts.dev?.includes('next')) return 'nextjs';
    }

    return null;
  }

  /**
   * 偵測專案類型
   */
  detectType(framework, deps) {
    // 如果有 Node.js 框架
    if (['express', 'fastify', 'koa'].includes(framework)) {
      return 'nodejs';
    }

    // 如果有前端框架
    if (['nextjs', 'vite', 'vite-react', 'vite-vue', 'create-react-app', 'angular', 'vue'].includes(framework)) {
      return 'frontend';
    }

    // 檢查是否有靜態檔案
    const staticDirs = ['public', 'dist', 'build', 'out', '_site'];
    for (const dir of staticDirs) {
      if (fs.existsSync(path.join(this.projectPath, dir))) {
        return 'static';
      }
    }

    return 'unknown';
  }

  /**
   * 產生配置
   */
  generateConfig(type, framework, packageJson) {
    const templates = {
      nextjs: {
        buildCommand: 'npm run build',
        startCommand: 'npm run start',
        port: 3000,
        outputDir: '.next'
      },
      vite: {
        buildCommand: 'npm run build',
        startCommand: 'npx serve dist -p 5000',
        port: 5000,
        outputDir: 'dist'
      },
      'vite-react': {
        buildCommand: 'npm run build',
        startCommand: 'npx serve dist -p 5000',
        port: 5000,
        outputDir: 'dist'
      },
      'vite-vue': {
        buildCommand: 'npm run build',
        startCommand: 'npx serve dist -p 5000',
        port: 5000,
        outputDir: 'dist'
      },
      'create-react-app': {
        buildCommand: 'npm run build',
        startCommand: 'npx serve build -p 5000',
        port: 5000,
        outputDir: 'build'
      },
      angular: {
        buildCommand: 'npm run build',
        startCommand: 'npx serve dist -p 4200',
        port: 4200,
        outputDir: 'dist'
      },
      express: {
        buildCommand: null,
        startCommand: 'npm start',
        port: this.detectPort(packageJson) || 3000
      },
      fastify: {
        buildCommand: null,
        startCommand: 'npm start',
        port: this.detectPort(packageJson) || 3000
      },
      koa: {
        buildCommand: null,
        startCommand: 'npm start',
        port: this.detectPort(packageJson) || 3000
      },
      static: {
        buildCommand: null,
        startCommand: 'npx serve . -p 8080',
        port: 8080
      }
    };

    // 優先使用框架模板
    if (framework && templates[framework]) {
      return templates[framework];
    }

    // fallback 到類型模板
    if (type === 'static') {
      return templates.static;
    }

    // 未知類型，嘗試從 package.json 推斷
    return {
      buildCommand: packageJson.scripts?.build ? 'npm run build' : null,
      startCommand: packageJson.scripts?.start ? 'npm start' : null,
      port: this.detectPort(packageJson) || 3000
    };
  }

  /**
   * 嘗試從 package.json 偵測端口
   */
  detectPort(packageJson) {
    // 檢查 scripts 中是否有端口設定
    const scripts = packageJson.scripts || {};
    for (const [key, value] of Object.entries(scripts)) {
      const match = value.match(/PORT=(\d+)|--port[= ](\d+)|-p[= ](\d+)/);
      if (match) {
        return parseInt(match[1] || match[2] || match[3]);
      }
    }

    // 檢查 config
    if (packageJson.config?.port) {
      return parseInt(packageJson.config.port);
    }

    return null;
  }
}

module.exports = ProjectDetector;
