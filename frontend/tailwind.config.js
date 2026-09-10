/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Значения — для ТЁМНОЙ темы; светлая переопределяет их в src/index.css
        // поверх тех же utility-классов (см. блок [data-theme='light']).
        bg: '#202224',
        card: '#2B2E30',
        line: 'rgba(255,255,255,0.09)',
        // Акцент Азбуки Вкуса. На тёмной — яркий лайм проходит по контрасту;
        // на светлой в index.css заменяется на тёмно-зелёный #184936.
        neon: '#63C634',
        'neon-dim': '#4FB026',
        // Статусы (отдельно от акцента): красный / оранжевый / золото / зелёный
        crit: '#E5726F',
        high: '#E0A652',
        med: '#DFB750',
        low: '#63C634',
      },
      fontFamily: {
        sans: ['"Golos Text"', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Golos Text"', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Golos Text"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Шкала по роли: поля/кнопки — control, карточки — card, модалки — panel
        control: '6px',
        card: '10px',
        panel: '14px',
      },
      boxShadow: {
        pop: '0 4px 20px rgba(34,35,37,.10)',
        panel: '0 24px 48px rgba(34,35,37,.22)',
      },
    },
  },
  plugins: [],
};
