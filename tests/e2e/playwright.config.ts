import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:1420' },
  webServer: {
    command: 'pnpm tauri dev',
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});