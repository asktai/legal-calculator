import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// SINGLE=1 时构建自包含单文件 HTML（所有 JS/CSS/动态 chunk 内联），产物在 dist-single/
// 用法：npx cross-env SINGLE=1 vite build 或 SINGLE=1 npx vite build
const single = process.env.SINGLE === '1';

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ...(single
    ? {
        build: {
          outDir: 'dist-single',
          emptyOutDir: true,
          chunkSizeWarningLimit: 5000,
        },
      }
    : {}),
  server: {
    host: true,
    port: 5173,
  },
});
