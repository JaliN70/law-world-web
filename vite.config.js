import { defineConfig } from 'vite';

export default defineConfig({
  base: '/law-world-web/',
  build: { outDir: 'dist', assetsDir: 'assets', chunkSizeWarningLimit: 800 },
  server: { port: 5173 },
});
