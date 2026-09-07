import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // На части Windows-машин "localhost" резолвится в IPv6 (::1), а Vite по
    // умолчанию слушает только его — сайт остаётся недоступен по 127.0.0.1.
    // host: true слушает все интерфейсы сразу, снимая эту рассинхронизацию.
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'backend/public',
    emptyOutDir: false,
  },
});
