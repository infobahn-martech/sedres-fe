import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sedres-fe/',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/sedres/api': {
        target: 'https://onlinebareed.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});