/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#17191D',
        card: '#1E2126',
        line: 'rgba(255,255,255,0.08)',
        neon: '#2FAF63',
        'neon-dim': '#1C8F4D',
        crit: '#E5484D',
        high: '#F76808',
        med: '#E2A336',
        low: '#2FAF63',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
