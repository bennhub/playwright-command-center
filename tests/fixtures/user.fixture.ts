import { test as base } from '@playwright/test';
import { uniqueUser } from '../utils/random';

type User = { username: string; password: string };

export const test = base.extend<{ testUser: User }>({
  testUser: async ({}, use, testInfo) => {
    const seed = `${testInfo.project.name}-${testInfo.title}-${testInfo.retry}`;
    await use(uniqueUser('qauser', seed));
  }
});

export const expect = test.expect;
