import { defineConfig } from 'vite';

export default defineConfig({
  base: '/law-world-web/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  },
});
