import { test, expect } from '@playwright/test';

test('navigate to beatbrush app', async ({ page }) => {
  await page.goto('https://beatbrush.hayzer.app');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Keep the browser open for interaction
  await page.pause();
});