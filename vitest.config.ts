import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-utils/**', 'src/main.tsx'],
      thresholds: {
        'src/editor/bridge/**': { lines: 85, functions: 85, branches: 80 },
        'src/editor/extensions/**': { lines: 80, functions: 80, branches: 75 },
        'src/**': { lines: 70, functions: 70, branches: 65 },
      },
    },
  },
});