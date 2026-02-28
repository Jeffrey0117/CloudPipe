/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'cp-primary': 'var(--cp-primary)',
        'cp-success': 'var(--cp-success)',
        'cp-warning': 'var(--cp-warning)',
        'cp-danger': 'var(--cp-danger)',
        'cp-bg': 'var(--cp-bg)',
        'cp-surface': 'var(--cp-surface)',
        'cp-border': 'var(--cp-border)',
        'cp-text': 'var(--cp-text)',
        'cp-muted': 'var(--cp-muted)',
      },
    },
  },
  plugins: [],
};
