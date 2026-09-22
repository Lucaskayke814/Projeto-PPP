import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  envDir: resolve(__dirname, '../..'),
  base: process.env.GITHUB_ACTIONS ? '/Projeto-PPP/' : '/',
  build: {
    rollupOptions: {
      input: {
        inicio: resolve(__dirname, 'index.html'),
        prototipo: resolve(__dirname, 'prototipo.html'),
      },
    },
  },
});
