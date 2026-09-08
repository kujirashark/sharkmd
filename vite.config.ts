import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
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