const dom = {
  menuBtn: document.getElementById('menuBtn'),
  menuDrawer: document.getElementById('menuDrawer'),
  aboutMenuItem: document.getElementById('aboutMenuItem'),
  readmeMenuItem: document.getElementById('readmeMenuItem'),
  aboutModal: document.getElementById('aboutModal'),
  closeAboutBtn: document.getElementById('closeAboutBtn'),
  readmeModal: document.getElementById('readmeModal'),
  readmeCodeWindow: document.getElementById('readmeCodeWindow'),
  closeReadmeBtn: document.getElementById('closeReadmeBtn'),
  statusText: document.getElementById('statusText'),
  projectSelect: document.getElementById('projectSelect'),
  rerunLastFailedBtn: document.getElementById('rerunLastFailedBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  selectAllSpecsBtn: document.getElementById('selectAllSpecsBtn'),
  deselectAllSpecsBtn: document.getElementById('deselectAllSpecsBtn'),
  runSelectedSuiteBtn: document.getElementById('runSelectedSuiteBtn'),
  globalSpecList: document.getElementById('globalSpecList'),
  globalActionGrid: document.getElementById('globalActionGrid'),
  videoBtn: document.getElementById('videoBtn'),
  reportBtn: document.getElementById('reportBtn'),
  stopBtn: document.getElementById('stopBtn'),
  specList: document.getElementById('specList'),
  historyList: document.getElementById('historyList'),
  logEl: document.getElementById('log')
};

const state = {
  specs: [],
  presets: [],
  history: [],
  lastFailed: null,
  batchRunning: false,
  running: false,
  run: null,
  pendingSpecsUpdate: null,
  pollTimer: null,
  selectedSpecs: new Set()
};

const README_FALLBACK = `# Parabank Automation Showcase

## What This App Is
Ben's Playwright Command Runner + Debugger for interview demos and fast troubleshooting.

## Mission
- Reduce CLI friction for running tests
- Make failures easy to inspect (trace/video/report)
- Provide a clear demo workflow for automation interviews

## Install
\`\`\`bash
npm ci
npx playwright install chromium
\`\`\`

## Run Launcher
\`\`\`bash
npm run test:e2e:launcher
\`\`\`

Open: http://127.0.0.1:4173

## Typical Workflow
1. Pick Target (Browser/Device)
2. Select specs in Global Spec Cart
3. Run command preset or Run Selected Suite + Report
4. Inspect View Latest Trace / View Latest Video
5. Open Latest Report for summary

## Key Features
- Global actions: rerun failed, history report, latest report/video, stop all
- Global spec selection with batch command execution
- Suite run mode for consolidated HTML report
- Per-test artifact viewing
- Dynamic spec auto-refresh when test files are added/removed
- Run history timeline`;

const api = {
  async get(path) {
    const res = await fetch(path);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${path}`);
    return data;
  },

  async post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${path}`);
    return data;
  }
};

function isBusy() {
  return state.running || state.batchRunning;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function appendLog(entry) {
  if (!entry || !entry.message) return;
  const ts = new Date(entry.ts).toLocaleTimeString();
  const line = `[${ts}] [${entry.level}] ${entry.message}`;
  dom.logEl.textContent += (dom.logEl.textContent ? '\n' : '') + line;
  dom.logEl.scrollTop = dom.logEl.scrollHeight;
}

function setRerunButtonState() {
  dom.rerunLastFailedBtn.disabled = isBusy() || !state.lastFailed;
}

function setStatus(status) {
  state.running = status.running;
  state.run = status.run;

  if (status.running && status.run) {
    const active = status.run.activePresetTitle ? ` - ${status.run.activePresetTitle}` : '';
    dom.statusText.textContent = `Running ${status.run.spec} (${status.run.project})${active}`;
  } else {
    dom.statusText.textContent = 'Idle';
  }

  setRerunButtonState();
  flushPendingSpecsUpdateIfIdle();
  renderGlobalSpecCart();
  renderSpecCards();
}

function areSameStringArrays(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function setSpecSyncBadge(text = '') {
  if (!dom.specSyncBadge) return;
  dom.specSyncBadge.textContent = text;
}

function applySpecsUpdate(nextSpecs) {
  const prevSelected = new Set(state.selectedSpecs);
  state.specs = nextSpecs;
  state.selectedSpecs = new Set([...prevSelected].filter((spec) => state.specs.includes(spec)));
  renderGlobalSpecCart();
  renderSpecCards();
}

function flushPendingSpecsUpdateIfIdle() {
  if (isBusy() || !state.pendingSpecsUpdate) return;
  applySpecsUpdate(state.pendingSpecsUpdate.specs);
  state.pendingSpecsUpdate = null;
  setSpecSyncBadge('Updated');
  setTimeout(() => setSpecSyncBadge(''), 3000);
}

function setHistory(data) {
  state.history = data?.history || [];
  state.lastFailed = data?.lastFailed || null;
  setRerunButtonState();
  renderHistory();
}

function renderHistory() {
  dom.historyList.innerHTML = '';
  for (const item of state.history) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const started = new Date(item.startedAt).toLocaleTimeString();
    row.innerHTML = `
      <div class="history-meta">${started} | ${item.project} | ${item.presetTitle}</div>
      <div class="history-main">${item.spec}</div>
      <div class="history-meta">
        <span class="status-chip ${item.status}">${item.status.toUpperCase()}</span>
        | ${formatDuration(item.durationMs)}
      </div>
    `;
    dom.historyList.appendChild(row);
  }
  if (!state.history.length) {
    dom.historyList.innerHTML = '<div class="history-meta">No runs yet.</div>';
  }
}

function renderGlobalPresetButton(preset) {
  return `
    <div class="preset">
      <button type="button" class="preset-btn" data-run-global-preset-id="${preset.id}" ${isBusy() ? 'disabled' : ''}>
        <span>
          <div class="preset-title">${preset.title}</div>
          <div class="preset-desc">${preset.description}</div>
        </span>
      </button>
    </div>
  `;
}

function renderGlobalSpecCart() {
  dom.globalSpecList.innerHTML = state.specs
    .map(
      (spec) => `
      <label class="spec-check">
        <input type="checkbox" data-global-spec="${spec}" ${state.selectedSpecs.has(spec) ? 'checked' : ''} ${isBusy() ? 'disabled' : ''} />
        <span>${spec}</span>
      </label>
    `
    )
    .join('');

  dom.globalActionGrid.innerHTML = state.presets.map((preset) => renderGlobalPresetButton(preset)).join('');

  dom.globalSpecList.querySelectorAll('input[data-global-spec]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const spec = e.currentTarget.dataset.globalSpec;
      if (e.currentTarget.checked) state.selectedSpecs.add(spec);
      else state.selectedSpecs.delete(spec);
      renderSpecCards();
    });
  });

  dom.globalActionGrid.querySelectorAll('button[data-run-global-preset-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const presetId = e.currentTarget.dataset.runGlobalPresetId;
      executePresetForSelected(presetId);
    });
  });

  dom.runSelectedSuiteBtn.disabled = isBusy() || state.selectedSpecs.size === 0;
}

function renderSpecCards() {
  dom.specList.innerHTML = '';

  for (const spec of state.specs) {
    const card = document.createElement('div');
    card.className = 'spec-card';
    const selected = state.selectedSpecs.has(spec) ? 'Selected in Global Cart' : 'Not selected';

    card.innerHTML = `
      <div class="spec-name">${spec}</div>
      <div class="spec-selected">${selected}</div>
      <div class="artifact-actions">
        <button type="button" class="btn-artifact" data-open-video-spec="${spec}">View Latest Video (This Test)</button>
        <button type="button" class="btn-artifact" data-open-trace-spec="${spec}">View Latest Trace</button>
      </div>
    `;

    dom.specList.appendChild(card);
  }

  dom.specList.querySelectorAll('button[data-open-video-spec]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const spec = e.currentTarget.dataset.openVideoSpec;
      openLatestArtifact(spec, 'video');
    });
  });

  dom.specList.querySelectorAll('button[data-open-trace-spec]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const spec = e.currentTarget.dataset.openTraceSpec;
      openLatestArtifact(spec, 'trace');
    });
  });
}

async function waitUntilIdle() {
  while (true) {
    const status = await api.get('/api/status');
    if (!status.running) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function executePresetForSelected(presetId) {
  if (isBusy()) return;

  const specs = state.specs.filter((spec) => state.selectedSpecs.has(spec));
  if (!specs.length) {
    alert('Select at least one spec in Global Spec Cart.');
    return;
  }

  state.batchRunning = true;
  setRerunButtonState();
  renderGlobalSpecCart();
  renderSpecCards();

  try {
    for (const spec of specs) {
      if (!state.batchRunning) break;
      const project = dom.projectSelect.value || 'chromium';
      await api.post('/api/run', { spec, project, presets: [presetId] });
      await waitUntilIdle();
    }
  } catch (err) {
    alert(err.message || 'Failed to run command.');
  } finally {
    state.batchRunning = false;
    setRerunButtonState();
    renderGlobalSpecCart();
    renderSpecCards();
  }
}

async function runSelectedSuite() {
  if (isBusy()) return;
  const specs = state.specs.filter((spec) => state.selectedSpecs.has(spec));
  if (!specs.length) {
    alert('Select at least one spec in Global Spec Cart.');
    return;
  }

  try {
    const project = dom.projectSelect.value || 'chromium';
    await api.post('/api/run-suite', { specs, project });
  } catch (err) {
    alert(err.message || 'Failed to run selected suite.');
  }
}

async function openLatestArtifact(spec, type) {
  try {
    const data = await api.get(`/api/artifact-status?spec=${encodeURIComponent(spec)}`);
    const available = data?.available?.[type];
    if (!available) {
      alert(`No ${type} found for this test yet. Run a matching command first.`);
      return;
    }
    if (type === 'trace') {
      window.open(`/trace/view?spec=${encodeURIComponent(spec)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(`/artifact/latest/${type}?spec=${encodeURIComponent(spec)}`, '_blank', 'noopener,noreferrer');
  } catch (err) {
    alert(err.message || 'Failed to open artifact.');
  }
}

function bindToolbarActions() {
  dom.stopBtn.addEventListener('click', async () => {
    state.batchRunning = false;
    try {
      await api.post('/api/stop');
    } catch (err) {
      alert(err.message || 'Nothing to stop.');
    }
    setRerunButtonState();
    renderGlobalSpecCart();
    renderSpecCards();
  });

  dom.selectAllSpecsBtn.addEventListener('click', () => {
    if (isBusy()) return;
    for (const spec of state.specs) state.selectedSpecs.add(spec);
    renderGlobalSpecCart();
    renderSpecCards();
  });

  dom.deselectAllSpecsBtn.addEventListener('click', () => {
    if (isBusy()) return;
    state.selectedSpecs.clear();
    renderGlobalSpecCart();
    renderSpecCards();
  });

  dom.runSelectedSuiteBtn.addEventListener('click', () => {
    runSelectedSuite();
  });

  dom.rerunLastFailedBtn.addEventListener('click', async () => {
    try {
      await api.post('/api/rerun-last-failed');
    } catch (err) {
      alert(err.message || 'Could not rerun last failed command.');
    }
  });

  dom.exportHtmlBtn.addEventListener('click', () => {
    window.open('/api/export/history.html', '_blank', 'noopener,noreferrer');
  });

  dom.reportBtn.addEventListener('click', async () => {
    try {
      const data = await api.get('/api/report-status');
      if (!data.available) {
        alert('No HTML report found yet. Run Reporter HTML for a test first.');
        return;
      }
      window.open('/report/', '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.message || 'Failed to open report.');
    }
  });

  dom.videoBtn.addEventListener('click', async () => {
    try {
      const data = await api.get('/api/video-status');
      if (!data.available) {
        alert('No video found yet. Run Video On for a test first.');
        return;
      }
      window.open('/video/latest', '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.message || 'Failed to open video.');
    }
  });

  dom.projectSelect.addEventListener('change', () => {
    renderGlobalSpecCart();
    renderSpecCards();
  });
}

function closeMenu() {
  dom.menuDrawer.classList.remove('open');
}

function openAboutModal() {
  dom.aboutModal.classList.add('open');
}

function closeAboutModal() {
  dom.aboutModal.classList.remove('open');
}

function openReadmeModal() {
  dom.readmeModal.classList.add('open');
}

function closeReadmeModal() {
  dom.readmeModal.classList.remove('open');
}

function bindMenuActions() {
  dom.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.menuDrawer.classList.toggle('open');
  });

  dom.aboutMenuItem.addEventListener('click', () => {
    closeMenu();
    openAboutModal();
  });

  dom.readmeMenuItem.addEventListener('click', () => {
    closeMenu();
    openReadmeModal();
    dom.readmeCodeWindow.textContent = 'Loading README...';
    fetch('/repo-readme')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load repository README.');
        return res.text();
      })
      .then((text) => {
        dom.readmeCodeWindow.textContent = text || README_FALLBACK;
      })
      .catch(() => {
        dom.readmeCodeWindow.textContent = README_FALLBACK;
      });
  });

  dom.closeAboutBtn.addEventListener('click', () => {
    closeAboutModal();
  });

  dom.aboutModal.addEventListener('click', (e) => {
    if (e.target === dom.aboutModal) closeAboutModal();
  });

  dom.closeReadmeBtn.addEventListener('click', () => {
    closeReadmeModal();
  });

  dom.readmeModal.addEventListener('click', (e) => {
    if (e.target === dom.readmeModal) closeReadmeModal();
  });

  document.addEventListener('click', (e) => {
    if (!dom.menuDrawer.contains(e.target) && e.target !== dom.menuBtn) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      closeAboutModal();
      closeReadmeModal();
    }
  });
}

function bindRealtimeEvents() {
  const events = new EventSource('/api/stream');
  events.addEventListener('status', (ev) => setStatus(JSON.parse(ev.data)));
  events.addEventListener('history', (ev) => setHistory(JSON.parse(ev.data)));
  events.addEventListener('log', (ev) => appendLog(JSON.parse(ev.data)));
}

async function pollSpecs() {
  try {
    const specsData = await api.get('/api/specs');
    const nextSpecs = specsData.specs || [];
    if (areSameStringArrays(state.specs, nextSpecs)) return;

    if (isBusy()) {
      state.pendingSpecsUpdate = { specs: nextSpecs };
      setSpecSyncBadge('Update queued');
      return;
    }

    applySpecsUpdate(nextSpecs);
    setSpecSyncBadge('Updated');
    setTimeout(() => setSpecSyncBadge(''), 3000);
  } catch {
    // keep silent during polling; do not disrupt runs/demo flow
  }
}

async function init() {
  const [specsData, statusData, logsData, historyData] = await Promise.all([
    api.get('/api/specs'),
    api.get('/api/status'),
    api.get('/api/logs'),
    api.get('/api/history')
  ]);

  state.specs = specsData.specs || [];
  state.presets = specsData.presets || [];

  dom.projectSelect.innerHTML = '';
  for (const project of specsData.projects || []) {
    const option = document.createElement('option');
    option.value = project;
    option.textContent = project;
    dom.projectSelect.appendChild(option);
  }
  dom.projectSelect.value = specsData.defaultProject || 'chromium';

  setStatus(statusData);
  setHistory(historyData);

  for (const entry of logsData.logs || []) appendLog(entry);

  bindToolbarActions();
  bindMenuActions();
  bindRealtimeEvents();

  state.pollTimer = setInterval(() => {
    pollSpecs();
  }, 8000);
}

init().catch((err) => {
  dom.statusText.textContent = `Error: ${err.message}`;
});
