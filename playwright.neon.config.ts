import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/neon', testMatch:'*.spec.ts', workers:1, timeout:60000,
  use:{baseURL:'http://localhost:3200',channel:'chrome'}, reporter:'list',
  webServer:{command:'pnpm exec node tests/neon/start-server.mjs',url:'http://localhost:3200/api/health',timeout:120000,reuseExistingServer:false},
});
