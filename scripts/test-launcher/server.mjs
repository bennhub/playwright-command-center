#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HOST = process.env.LAUNCHER_HOST || '127.0.0.1';
const PORT = Number(process.env.LAUNCHER_PORT || 4173);
const PROJECTS = ['chromium', 'mobile-chrome'];
const COMMAND_PRESETS = [
  {
    id: 'debug',
    title: 'Debug',
    description: 'Headed browser + Playwright Inspector',
    flags: ['--headed', '--debug'],
    env: { HEADLESS: 'false' }
  },
  {
    id: 'headed',
    title: 'Headed',
    description: 'Visible browser run without inspector',
    flags: ['--headed'],
    env: { HEADLESS: 'false' }
  },
  {
    id: 'headless',
    title: 'Headless',
    description: 'Fast no-UI run',
    flags: [],
    env: { HEADLESS: 'true' }
  },
  {
    id: 'trace',
    title: 'Trace On',
    description: 'Collect trace for every step',
    flags: ['--headed', '--trace', 'on'],
    env: { HEADLESS: 'false' }
  },
  {
    id: 'repeat3',
    title: 'Repeat x3',
    description: 'Run the same test three times',
    flags: ['--headed', '--repeat-each', '3'],
    env: { HEADLESS: 'false' }
  }
];
const rootDir = process.cwd();
const specsDir = path.join(rootDir, 'tests', 'specs');
const staticIndex = path.join(rootDir, 'scripts', 'test-launcher', 'index.html');

let currentRun = null;
let logs = [];
let nextLogId = 1;
const clients = new Set();

function sendJson(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendEvent(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(msg);
  }
}

function appendLog(level, message) {
  const entry = {
    id: nextLogId++,
    ts: new Date().toISOString(),
    level,
    message
  };
  logs.push(entry);
  if (logs.length > 1500) logs = logs.slice(-1500);
  sendEvent('log', entry);
}

async function listSpecs() {
  if (!existsSync(specsDir)) return [];
  const items = await readdir(specsDir, { withFileTypes: true });
  return items
    .filter((item) => item.isFile() && item.name.endsWith('.spec.ts'))
    .map((item) => `tests/specs/${item.name}`)
    .sort();
}

function getStatus() {
  return {
    running: Boolean(currentRun),
    run: currentRun
      ? {
          spec: currentRun.spec,
          project: currentRun.project,
          presets: currentRun.presetIds,
          activePresetTitle: currentRun.activePresetTitle,
          activeCommand: currentRun.activeCommand,
          startedAt: currentRun.startedAt,
          pid: currentRun.child.pid
        }
      : null
  };
}

async function startRun(spec, project, presetIds) {
  if (currentRun) {
    return { ok: false, error: 'A test is already running. Stop it or wait for completion.' };
  }

  const presetMap = new Map(COMMAND_PRESETS.map((preset) => [preset.id, preset]));
  const selectedPresets = presetIds.map((id) => presetMap.get(id)).filter(Boolean);
  if (!selectedPresets.length) {
    return { ok: false, error: 'Select at least one command option.' };
  }

  let stopRequested = false;
  let runInProgress = true;

  const runSinglePreset = (preset) =>
    new Promise((resolve) => {
      const args = ['playwright', 'test', spec, '--project', project, ...preset.flags];
      const presetEnv = preset.env || {};
      const child = spawn('npx', args, {
        cwd: rootDir,
        env: { ...process.env, ...presetEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      const envPrefix = Object.entries(presetEnv)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      const printableCommand = `${envPrefix ? `${envPrefix} ` : ''}npx ${args.join(' ')}`;

      currentRun = {
        spec,
        project,
        presetIds,
        activePresetTitle: preset.title,
        activeCommand: printableCommand,
        startedAt: new Date().toISOString(),
        child,
        stop: () => {
          stopRequested = true;
          child.kill('SIGINT');
        }
      };

      appendLog('info', `[${preset.title}] $ ${printableCommand}`);
      sendEvent('status', getStatus());

      child.stdout.on('data', (chunk) => {
        const text = String(chunk);
        if (text.trim()) appendLog('stdout', text.trimEnd());
      });
      child.stderr.on('data', (chunk) => {
        const text = String(chunk);
        if (text.trim()) appendLog('stderr', text.trimEnd());
      });

      child.on('close', (code, signal) => {
        const exitText = signal ? `terminated by ${signal}` : `exited ${code}`;
        appendLog(code === 0 ? 'info' : 'error', `[${preset.title}] Run finished: ${exitText}`);
        resolve({ code: code ?? 1, signal });
      });

      child.on('error', (err) => {
        appendLog('error', `[${preset.title}] Failed to start: ${err.message}`);
        resolve({ code: 1, signal: null });
      });
    });

  (async () => {
    for (const preset of selectedPresets) {
      const result = await runSinglePreset(preset);
      if (stopRequested || result.signal || result.code !== 0) {
        if (stopRequested) appendLog('info', 'Run sequence stopped by user.');
        break;
      }
    }
    runInProgress = false;
    currentRun = null;
    sendEvent('status', getStatus());
  })();

  return { ok: true, queued: selectedPresets.length, runInProgress };
}

function stopRun() {
  if (!currentRun) return { ok: false, error: 'No running test to stop.' };
  currentRun.stop();
  appendLog('info', 'Stop requested (SIGINT).');
  return { ok: true };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(staticIndex, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/specs') {
      const specs = await listSpecs();
      sendJson(res, 200, {
        specs,
        projects: PROJECTS,
        defaultProject: 'chromium',
        presets: COMMAND_PRESETS
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      sendJson(res, 200, getStatus());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/logs') {
      sendJson(res, 200, { logs });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      });
      res.write(`event: status\ndata: ${JSON.stringify(getStatus())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const spec = String(body.spec || '');
      const project = String(body.project || 'chromium');
      const presets = Array.isArray(body.presets) ? body.presets.map(String) : [];

      const validSpecs = await listSpecs();
      if (!validSpecs.includes(spec)) {
        sendJson(res, 400, { ok: false, error: 'Invalid spec path.' });
        return;
      }
      if (!PROJECTS.includes(project)) {
        sendJson(res, 400, { ok: false, error: 'Invalid project.' });
        return;
      }
      const validPresetIds = new Set(COMMAND_PRESETS.map((preset) => preset.id));
      if (!presets.length || presets.some((preset) => !validPresetIds.has(preset))) {
        sendJson(res, 400, { ok: false, error: 'Invalid command selection.' });
        return;
      }

      const result = await startRun(spec, project, presets);
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const result = stopRun();
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Playwright Debug Launcher running at http://${HOST}:${PORT}`);
});
