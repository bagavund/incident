/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090B',
        card: '#111113',
        line: 'rgba(0,255,102,0.14)',
        neon: '#00FF66',
        'neon-dim': '#0B9E4A',
        crit: '#FF3B3B',
        high: '#FF8A00',
        med: '#FFD400',
        low: '#00FF66',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 10px rgba(0,255,102,0.2)',
        'neon-lg': '0 0 24px rgba(0,255,102,0.28)',
      },
      backgroundImage: {
        grid:
          'linear-gradient(rgba(0,255,102,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,102,0.035) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
};
