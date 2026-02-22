import { randomBytes } from 'node:crypto';

export function uniqueSuffix(seed = ''): string {
  const now = Date.now().toString(36).slice(-4);
  const rand = randomBytes(4).toString('hex');
  const cleanedSeed = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toLowerCase();
  return `${rand}${now}${cleanedSeed}`.toLowerCase();
}

export function uniqueUser(prefix = 'qauser', seed = ''): { username: string; password: string } {
  const suffix = uniqueSuffix(seed);
  const username = `${prefix}_${suffix}`.slice(0, 20).toLowerCase();
  return {
    username,
    password: `Pw!${suffix}Aa1`
  };
}
