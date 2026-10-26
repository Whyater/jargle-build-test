import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.output/results',
  fullyParallel: true,
  // Short limits so a broken screen fails fast instead of stalling the whole run.
  timeout: 20000,
  expect: { timeout: 5000 },
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/.output/report', open: 'never' }],
    ['json', { outputFile: 'e2e/.output/results.json' }],
  ],
  use: {
    actionTimeout: 5000,
    navigationTimeout: 10000,
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
