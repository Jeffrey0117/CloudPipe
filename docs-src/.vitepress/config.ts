import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'CloudPipe',
  description: 'Zero-config deployment for your apps',
  base: '/docs/',
  outDir: '../public/docs',

  head: [
    ['link', { rel: 'icon', href: '/docs/newfav.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首頁', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: 'CLI', link: '/cli/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入門',
          items: [
            { text: '快速開始', link: '/guide/getting-started' },
            { text: '安裝設定', link: '/guide/installation' },
          ]
        },
        {
          text: '部署方式',
          items: [
            { text: 'GitHub 部署', link: '/guide/deploy-github' },
            { text: '上傳部署', link: '/guide/deploy-upload' },
            { text: 'Webhook 設定', link: '/guide/webhook' },
          ]
        },
        {
          text: '進階設定',
          items: [
            { text: '專案設定', link: '/guide/project-config' },
            { text: 'PM2 設定', link: '/guide/pm2-config' },
            { text: 'Cloudflare Tunnel', link: '/guide/cloudflare-tunnel' },
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI 指令',
          items: [
            { text: '總覽', link: '/cli/' },
            { text: 'deploy', link: '/cli/deploy' },
            { text: 'list', link: '/cli/list' },
            { text: 'logs', link: '/cli/logs' },
            { text: 'delete', link: '/cli/delete' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: '總覽', link: '/api/' },
            { text: '認證', link: '/api/auth' },
            { text: '專案', link: '/api/projects' },
            { text: '部署', link: '/api/deployments' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Jeffrey0117/CloudPipe' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present'
    },

    search: {
      provider: 'local'
    }
  }
})
