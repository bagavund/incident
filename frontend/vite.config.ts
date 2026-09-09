import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // На части Windows-машин "localhost" резолвится в IPv6 (::1), а Vite по
    // умолчанию слушает только его — сайт остаётся недоступен по 127.0.0.1.
    // host: true слушает все интерфейсы сразу, снимая эту рассинхронизацию.
    host: true,
    // Локальная разработка: backend поднят отдельно на :8000
    // (`cd ../backend && php artisan serve`). В проде тем же путём проксирует nginx.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
});
