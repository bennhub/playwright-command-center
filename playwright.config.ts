import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, HEADLESS } from './config/env';

type VideoMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
const VIDEO_MODE = (process.env.VIDEO as VideoMode | undefined) || 'retain-on-failure';

export default defineConfig({
  testDir: './tests/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: HEADLESS,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: VIDEO_MODE,
    ignoreHTTPSErrors: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }
  ]
});
