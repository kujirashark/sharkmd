import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const DEMO_FILE = process.env.SHARKMD_DEMO_FILE || '';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sharkmd-demo-loader',
      transformIndexHtml() {
        if (!DEMO_FILE) return [];
        const safe = JSON.stringify(DEMO_FILE);
        return [{
          tag: 'script',
          injectTo: 'head',
          children: `window.__SHARKMD_DEMO__ = ${safe};`,
        }];
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Windows: cargo build 写 .exe 时 Vite watch 会 EBUSY；忽略 src-tauri 整棵
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/target/**',
        '**/dist/**',
        '**/node_modules/**',
      ],
    },
  },
  build: { target: 'es2022', sourcemap: true },
});