#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const groups = [
  {
    name: 'Auth + Account',
    specs: ['tests/specs/01-register-login.spec.ts', 'tests/specs/02-negative-login.spec.ts', 'tests/specs/03-open-account.spec.ts']
  },
  {
    name: 'Money Movement',
    specs: ['tests/specs/04-transfer-funds.spec.ts', 'tests/specs/05-bill-pay.spec.ts']
  },
  {
    name: 'API Observability',
    specs: ['tests/specs/06-api-observability.spec.ts']
  }
];
const projects = (process.env.CC_PROJECTS || 'chromium,mobile-chrome')
  .split(',')
  .map((project) => project.trim())
  .filter(Boolean);
const retries = process.env.CC_RETRIES || '1';

const status = groups.map((group) => ({
  name: group.name,
  specs: group.specs.length,
  state: 'queued',
  exitCode: null,
  durationMs: 0,
  startedAt: 0,
  stdoutFile: `./test-results/${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.log`
}));

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function renderDashboard() {
  process.stdout.write('\x1Bc');
  console.log('Parabank Command Center');
  console.log(`Updated: ${new Date().toLocaleString()}`);
  console.log('');
  console.log('Worker | Scenario Group      | Specs | State    | Duration | Exit');
  console.log('-------+----------------------+-------+----------+----------+-----');

  status.forEach((s, idx) => {
    const worker = String(idx + 1).padEnd(6, ' ');
    const name = s.name.padEnd(20, ' ').slice(0, 20);
    const specs = String(s.specs).padEnd(5, ' ');
    const state = s.state.padEnd(8, ' ');
    const duration = formatDuration(s.durationMs).padEnd(8, ' ');
    const exit = s.exitCode === null ? '-' : String(s.exitCode);
    console.log(`${worker} | ${name} | ${specs} | ${state} | ${duration} | ${exit}`);
  });

  console.log('');
  console.log(`Playwright projects: ${projects.join(', ')} | Retries: ${retries}`);
  console.log('Worker logs are saved to ./test-results/*.log');
  console.log('HTML report: npx playwright show-report');
}

async function runGroup(group, idx) {
  const details = status[idx];
  details.state = 'running';
  details.startedAt = Date.now();

  const args = ['playwright', 'test', ...group.specs, '--workers', '1', '--retries', retries, '--reporter=list'];
  for (const project of projects) {
    args.push('--project', project);
  }
  const child = spawn('npx', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  return new Promise((resolve) => {
    child.on('close', async (code) => {
      details.durationMs = Date.now() - details.startedAt;
      details.state = code === 0 ? 'passed' : 'failed';
      details.exitCode = code ?? 1;
      await writeFile(details.stdoutFile, output);
      resolve({ idx, output, code: code ?? 1 });
    });
  });
}

const interval = setInterval(() => {
  status.forEach((s) => {
    if (s.state === 'running') {
      s.durationMs = Date.now() - s.startedAt;
    }
  });
  renderDashboard();
}, 1000);

await mkdir('./test-results', { recursive: true });
renderDashboard();

const runs = groups.map((group, idx) => runGroup(group, idx));
const results = await Promise.all(runs);

clearInterval(interval);
renderDashboard();

const hasFailure = results.some((r) => r.code !== 0);
if (hasFailure) {
  process.exitCode = 1;
}
