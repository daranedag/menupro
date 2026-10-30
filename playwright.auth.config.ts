import { defineConfig } from '@playwright/test';

// This suite uses a local fake InsForge service. It never creates real accounts.
export default defineConfig({
  testDir: './tests/auth',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:3100' },
  reporter: 'list',
  webServer: [
    {
      command: 'pnpm exec node tests/auth/mock-insforge.mjs',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm dev --port 3100 --hostname 127.0.0.1',
      url: 'http://localhost:3100/api/health',
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_INSFORGE_URL: 'http://127.0.0.1:3101',
        NEXT_PUBLIC_INSFORGE_ANON_KEY: 'local-auth-test-only',
        APP_URL: 'http://localhost:3100',
      },
    },
  ],
});
