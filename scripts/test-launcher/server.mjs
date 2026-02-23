#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
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
    id: 'ui-mode',
    title: 'UI Mode',
    description: 'Open Playwright UI mode for this spec',
    flags: ['--ui'],
    env: { HEADLESS: 'false' }
  },
  {
    id: 'trace',
    title: 'Trace On',
    description: 'Collect trace for every step',
    flags: ['--headed', '--trace', 'on'],
    env: { HEADLESS: 'false' }
  },
  {
    id: 'video-on',
    title: 'Video On',
    description: 'Record video for this run',
    flags: [],
    env: { HEADLESS: 'true', VIDEO: 'on' }
  },
  {
    id: 'reporter-html',
    title: 'Reporter HTML',
    description: 'Generate HTML report output',
    flags: ['--reporter', 'html'],
    env: { HEADLESS: 'true' }
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
const staticAppJs = path.join(rootDir, 'scripts', 'test-launcher', 'app.js');
const staticReadme = path.join(rootDir, 'scripts', 'test-launcher', 'README.md');
const rootReadme = path.join(rootDir, 'README.md');
const reportDir = path.join(rootDir, 'playwright-report');
const testResultsDir = path.join(rootDir, 'test-results');

let currentRun = null;
let logs = [];
let nextLogId = 1;
let runHistory = [];
let nextHistoryId = 1;
const clients = new Set();

function sendJson(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendJsonWithCors(res, code, payload) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function sendEvent(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(msg);
  }
}

function getHistorySnapshot() {
  return runHistory;
}

function getLastFailedHistory() {
  return runHistory.find((item) => item.status === 'failed') || null;
}

function publishHistory() {
  sendEvent('history', {
    history: getHistorySnapshot(),
    lastFailed: getLastFailedHistory()
  });
}

function addHistoryEntry(entry) {
  runHistory.unshift(entry);
  if (runHistory.length > 300) runHistory = runHistory.slice(0, 300);
  publishHistory();
}

function updateHistoryEntry(id, patch) {
  const idx = runHistory.findIndex((item) => item.id === id);
  if (idx === -1) return;
  runHistory[idx] = { ...runHistory[idx], ...patch };
  publishHistory();
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.map') return 'application/json; charset=utf-8';
  if (ext === '.zip') return 'application/zip';
  return 'application/octet-stream';
}

async function serveReportFile(res, relativePath) {
  if (!existsSync(reportDir)) {
    sendJson(res, 404, { error: 'No report found. Run a test with HTML reporter first.' });
    return;
  }

  const safeRelative = relativePath.replace(/^\/+/, '');
  const wanted = safeRelative ? safeRelative : 'index.html';
  const resolved = path.resolve(reportDir, wanted);
  if (!resolved.startsWith(path.resolve(reportDir))) {
    sendJson(res, 400, { error: 'Invalid report path.' });
    return;
  }

  if (!existsSync(resolved)) {
    sendJson(res, 404, { error: 'Report asset not found.' });
    return;
  }

  const body = await readFile(resolved);
  res.writeHead(200, { 'content-type': contentTypeFor(resolved) });
  res.end(body);
}

function openTraceViewerUrl(req, spec) {
  const host = req.headers.host || `${HOST}:${PORT}`;
  const traceUrl = `http://${host}/artifact/latest/trace?spec=${encodeURIComponent(spec)}`;
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`;
}

async function findLatestVideo() {
  if (!existsSync(testResultsDir)) return null;
  const found = [];

  async function walk(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webm')) {
        const info = await stat(full);
        found.push({ full, mtimeMs: info.mtimeMs });
      }
    }
  }

  await walk(testResultsDir);
  if (!found.length) return null;
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found[0].full;
}

function specKey(specPath) {
  const base = path.basename(String(specPath || ''), '.spec.ts');
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function findLatestArtifact({ ext, nameIncludes, spec }) {
  if (!existsSync(testResultsDir)) return null;
  const found = [];
  const key = spec ? specKey(spec) : '';

  async function walk(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const lowerName = entry.name.toLowerCase();
      if (ext && path.extname(lowerName) !== ext) continue;
      if (nameIncludes && !lowerName.includes(nameIncludes)) continue;

      const normalizedPath = full.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (key && !normalizedPath.includes(key)) continue;

      const info = await stat(full);
      found.push({ full, mtimeMs: info.mtimeMs });
    }
  }

  await walk(testResultsDir);
  if (!found.length) return null;
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found[0].full;
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

function buildHistoryExport() {
  const generatedAt = new Date().toISOString();
  const passed = runHistory.filter((item) => item.status === 'passed').length;
  const failed = runHistory.filter((item) => item.status === 'failed').length;
  const running = runHistory.filter((item) => item.status === 'running').length;
  return {
    generatedAt,
    totals: {
      runs: runHistory.length,
      passed,
      failed,
      running
    },
    history: runHistory
  };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHistoryHtmlReport() {
  const payload = buildHistoryExport();
  const rows = payload.history
    .map((item) => {
      const started = new Date(item.startedAt).toLocaleString();
      const duration = item.durationMs === null ? '-' : `${(item.durationMs / 1000).toFixed(2)}s`;
      return `<tr>
  <td>${escapeHtml(started)}</td>
  <td>${escapeHtml(item.spec)}</td>
  <td>${escapeHtml(item.project)}</td>
  <td>${escapeHtml(item.presetTitle)}</td>
  <td>${escapeHtml(item.status)}</td>
  <td>${escapeHtml(duration)}</td>
  <td><code>${escapeHtml(item.command)}</code></td>
</tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Playwright Command Center - Run History</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #1f1f1f; }
    h1 { margin: 0 0 8px; }
    .muted { color: #666; margin-bottom: 16px; }
    .cards { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .card { border: 1px solid #d9d9d9; border-radius: 10px; padding: 10px 12px; background: #fafafa; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: left; font-size: 13px; }
    th { background: #f2f2f2; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Playwright Command Center - Run History</h1>
  <div class="muted">Generated: ${escapeHtml(new Date(payload.generatedAt).toLocaleString())}</div>
  <div class="cards">
    <div class="card">Runs: <strong>${payload.totals.runs}</strong></div>
    <div class="card">Passed: <strong>${payload.totals.passed}</strong></div>
    <div class="card">Failed: <strong>${payload.totals.failed}</strong></div>
    <div class="card">Running: <strong>${payload.totals.running}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Started</th>
        <th>Spec</th>
        <th>Project</th>
        <th>Command</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Full Command</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No runs yet.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
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
      const runStartedAt = new Date().toISOString();
      const historyId = nextHistoryId++;

      currentRun = {
        spec,
        project,
        presetIds,
        activePresetTitle: preset.title,
        activeCommand: printableCommand,
        startedAt: runStartedAt,
        child,
        stop: () => {
          stopRequested = true;
          child.kill('SIGINT');
        }
      };

      addHistoryEntry({
        id: historyId,
        spec,
        project,
        presetId: preset.id,
        presetTitle: preset.title,
        command: printableCommand,
        startedAt: runStartedAt,
        endedAt: null,
        durationMs: null,
        status: 'running',
        exitCode: null,
        signal: null
      });

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
        const endedAt = new Date().toISOString();
        updateHistoryEntry(historyId, {
          endedAt,
          durationMs: Date.parse(endedAt) - Date.parse(runStartedAt),
          status: code === 0 ? 'passed' : 'failed',
          exitCode: code ?? 1,
          signal: signal ?? null
        });
        resolve({ code: code ?? 1, signal });
      });

      child.on('error', (err) => {
        appendLog('error', `[${preset.title}] Failed to start: ${err.message}`);
        const endedAt = new Date().toISOString();
        updateHistoryEntry(historyId, {
          endedAt,
          durationMs: Date.parse(endedAt) - Date.parse(runStartedAt),
          status: 'failed',
          exitCode: 1,
          signal: null
        });
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

async function startSuiteRun(specs, project) {
  if (currentRun) {
    return { ok: false, error: 'A test is already running. Stop it or wait for completion.' };
  }

  const args = ['playwright', 'test', ...specs, '--project', project];
  const printableCommand = `npx ${args.join(' ')}`;
  const runStartedAt = new Date().toISOString();
  const historyId = nextHistoryId++;

  const child = spawn('npx', args, {
    cwd: rootDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  currentRun = {
    spec: `${specs.length} selected specs`,
    project,
    presetIds: ['suite'],
    activePresetTitle: 'Selected Suite',
    activeCommand: printableCommand,
    startedAt: runStartedAt,
    child,
    stop: () => {
      child.kill('SIGINT');
    }
  };

  addHistoryEntry({
    id: historyId,
    spec: `${specs.length} selected specs`,
    project,
    presetId: 'suite',
    presetTitle: 'Selected Suite',
    command: printableCommand,
    startedAt: runStartedAt,
    endedAt: null,
    durationMs: null,
    status: 'running',
    exitCode: null,
    signal: null
  });

  appendLog('info', `[Selected Suite] $ ${printableCommand}`);
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
    appendLog(code === 0 ? 'info' : 'error', `[Selected Suite] Run finished: ${exitText}`);
    const endedAt = new Date().toISOString();
    updateHistoryEntry(historyId, {
      endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(runStartedAt),
      status: code === 0 ? 'passed' : 'failed',
      exitCode: code ?? 1,
      signal: signal ?? null
    });
    currentRun = null;
    sendEvent('status', getStatus());
  });

  child.on('error', (err) => {
    appendLog('error', `[Selected Suite] Failed to start: ${err.message}`);
    const endedAt = new Date().toISOString();
    updateHistoryEntry(historyId, {
      endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(runStartedAt),
      status: 'failed',
      exitCode: 1,
      signal: null
    });
    currentRun = null;
    sendEvent('status', getStatus());
  });

  return { ok: true, queued: specs.length, mode: 'suite' };
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

    if (req.method === 'GET' && url.pathname === '/app.js') {
      const js = await readFile(staticAppJs, 'utf8');
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
      res.end(js);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/launcher-readme') {
      const md = await readFile(staticReadme, 'utf8');
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
      res.end(md);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/repo-readme') {
      const md = await readFile(rootReadme, 'utf8');
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
      res.end(md);
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

    if (req.method === 'GET' && url.pathname === '/api/report-status') {
      sendJson(res, 200, { available: existsSync(path.join(reportDir, 'index.html')) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/video-status') {
      const latestVideo = await findLatestVideo();
      sendJson(res, 200, { available: Boolean(latestVideo) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/artifact-status') {
      const spec = String(url.searchParams.get('spec') || '');
      const latestVideo = await findLatestArtifact({ ext: '.webm', spec });
      const latestTrace = await findLatestArtifact({ ext: '.zip', nameIncludes: 'trace', spec });
      sendJsonWithCors(res, 200, {
        available: {
          video: Boolean(latestVideo),
          trace: Boolean(latestTrace)
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      sendJson(res, 200, getStatus());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/history') {
      sendJson(res, 200, {
        history: getHistorySnapshot(),
        lastFailed: getLastFailedHistory()
      });
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
      res.write(
        `event: history\ndata: ${JSON.stringify({ history: getHistorySnapshot(), lastFailed: getLastFailedHistory() })}\n\n`
      );
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

    if (req.method === 'POST' && url.pathname === '/api/run-suite') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const project = String(body.project || 'chromium');
      const specs = Array.isArray(body.specs) ? body.specs.map(String) : [];

      if (!PROJECTS.includes(project)) {
        sendJson(res, 400, { ok: false, error: 'Invalid project.' });
        return;
      }

      const validSpecs = await listSpecs();
      if (!specs.length) {
        sendJson(res, 400, { ok: false, error: 'Select at least one spec.' });
        return;
      }
      if (specs.some((spec) => !validSpecs.includes(spec))) {
        sendJson(res, 400, { ok: false, error: 'Invalid spec selection.' });
        return;
      }

      const result = await startSuiteRun(specs, project);
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const result = stopRun();
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/rerun-last-failed') {
      if (currentRun) {
        sendJson(res, 409, { ok: false, error: 'A test is already running.' });
        return;
      }
      const lastFailed = getLastFailedHistory();
      if (!lastFailed) {
        sendJson(res, 404, { ok: false, error: 'No failed runs in history yet.' });
        return;
      }
      const result = await startRun(lastFailed.spec, lastFailed.project, [lastFailed.presetId]);
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/export/history.html') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      res.end(renderHistoryHtmlReport());
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/report' || url.pathname === '/report/')) {
      await serveReportFile(res, 'index.html');
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/report/')) {
      const rel = url.pathname.slice('/report/'.length);
      await serveReportFile(res, rel);
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/video/latest' || url.pathname === '/video/latest/')) {
      const latestVideo = await findLatestVideo();
      if (!latestVideo) {
        sendJson(res, 404, { error: 'No video found. Run a test with Video On first.' });
        return;
      }
      const body = await readFile(latestVideo);
      res.writeHead(200, { 'content-type': 'video/webm' });
      res.end(body);
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/artifact/latest/video' || url.pathname === '/artifact/latest/video/')) {
      const spec = String(url.searchParams.get('spec') || '');
      const latestVideo = await findLatestArtifact({ ext: '.webm', spec });
      if (!latestVideo) {
        sendJsonWithCors(res, 404, { error: 'No matching video found for this spec.' });
        return;
      }
      const body = await readFile(latestVideo);
      res.writeHead(200, {
        'content-type': 'video/webm',
        'access-control-allow-origin': '*'
      });
      res.end(body);
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/artifact/latest/trace' || url.pathname === '/artifact/latest/trace/')) {
      const spec = String(url.searchParams.get('spec') || '');
      const latestTrace = await findLatestArtifact({ ext: '.zip', nameIncludes: 'trace', spec });
      if (!latestTrace) {
        sendJsonWithCors(res, 404, { error: 'No matching trace found for this spec.' });
        return;
      }
      const body = await readFile(latestTrace);
      res.writeHead(200, {
        'content-type': 'application/zip',
        'content-disposition': `inline; filename=\"${path.basename(latestTrace)}\"`,
        'access-control-allow-origin': '*'
      });
      res.end(body);
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/trace/view' || url.pathname === '/trace/view/')) {
      const spec = String(url.searchParams.get('spec') || '');
      const latestTrace = await findLatestArtifact({ ext: '.zip', nameIncludes: 'trace', spec });
      if (!latestTrace) {
        sendJson(res, 404, { error: 'No matching trace found for this spec.' });
        return;
      }
      res.writeHead(302, { location: openTraceViewerUrl(req, spec) });
      res.end();
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
