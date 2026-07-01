import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: command === "build" ? "/sedres-fe/" : "/",  // build vs dev
  build: {
    outDir: 'dist',
  },
});
