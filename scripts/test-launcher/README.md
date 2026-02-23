# Playwright Command Runner + Debugger

## What This App Is
A local web command center for running Playwright tests quickly during development and demo sessions.

It combines:
- command execution for selected specs
- debug and artifact workflows (video/trace/report)
- run history for fast review

## Mission
Make Playwright test execution and troubleshooting fast, visible, and demo-friendly.

Goals:
- reduce command-line friction
- standardize run commands
- make failures easy to analyze
- produce clear artifacts for interview walkthroughs

## Core Features
- Global Spec Cart with select/deselect and batch execution
- Dynamic spec detection (auto-refreshes spec lists when test files are added/removed)
- One-click command presets (Debug, Headed, Headless, UI Mode, Trace, Video, etc.)
- Single-command "Run Selected Suite + Report" for consolidated HTML report
- Per-test artifact actions:
  - View Latest Video (This Test)
  - View Latest Trace
- Global actions:
  - Rerun Last Failed
  - Open History Report
  - Open Latest Report
  - View Latest Video (Global)
  - Stop all
- Run History panel with status and duration

## Install
From repository root:

```bash
npm ci
npx playwright install chromium
```

## Run
Start the launcher:

```bash
npm run test:e2e:launcher
```

Open in browser:

```text
http://127.0.0.1:4173
```

## Typical Workflow
1. Choose `Target (Browser/Device)`.
2. Select specs in Global Spec Cart.
3. Run a command preset or run selected suite.
4. Inspect failures via trace/video/history.
5. Open HTML report for summary.

## Notes
- Trace viewer uses `https://trace.playwright.dev` and loads trace artifacts from your local launcher server.
- Global report is best produced via `Run Selected Suite + Report`.
