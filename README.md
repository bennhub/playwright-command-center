# Parabank Automation Showcase

Playwright-based automation framework for a banking-style application (`parabank.parasoft.com`) designed for technical interview demonstration.

## Framework Structure
- `tests/specs/` - end-to-end scenarios
- `tests/pages/` - page objects
- `tests/fixtures/` - test fixtures
- `tests/utils/` - helpers and data generation
- `config/` - environment defaults
- `.github/workflows/` - CI pipeline with artifact uploads

## High-Value Flows Implemented
1. User registration + login validation
2. Negative login validation
3. Open new account
4. Transfer funds
5. Bill payment
6. API observability for transfer endpoint response

## Run Locally
```bash
npm ci
npx playwright install chromium
npx playwright test
```

## Demo Commands
```bash
# Live interactive test runner
npx playwright test --ui

# One-click debug launcher for single specs (opens browser + inspector)
npm run test:e2e:launcher

# Optional command-center dashboard (parallel grouped suites)
npm run test:e2e:dashboard

# Headed run in one browser
npx playwright test --headed --project=chromium

# Open HTML report
npx playwright show-report
```

## Optional Command Center
`scripts/command-center.mjs` provides a lightweight terminal dashboard that runs grouped suites in parallel with `chromium` + `mobile-chrome` by default and writes worker logs to `test-results/*.log`.

```bash
# Optional overrides
CC_PROJECTS=chromium,mobile-chrome CC_RETRIES=1 npm run test:e2e:dashboard
```

## Debug Launcher UI
`scripts/test-launcher/server.mjs` starts a local UI that lists each `tests/specs/*.spec.ts` file and lets you execute one command per click:

- Global Spec Cart: select/deselect tests, then run one command preset across all selected specs
- Dynamic spec detection: test lists auto-refresh when `tests/specs/*.spec.ts` files are added/removed
- Suite command: `Run Selected Suite + Report` (single Playwright invocation for combined report output)
- Command presets include: `Debug`, `Headed`, `Headless`, `UI Mode`, `Trace On`, `Video On`, `Reporter HTML`, `Repeat x3`
- Per-test artifact actions: `View Latest Video (This Test)`, `View Latest Trace`
- Global actions: `Rerun Last Failed`, `Open History Report`, `View Latest Video (Global)`, `Open Latest Report`, `Stop all`
- Run history panel with timestamp/spec/command/status/duration
- Supports target selector (`chromium` or `mobile-chrome`)
- Streams command output in-app and exposes a stop button (`SIGINT`)
- Frontend logic is split into `scripts/test-launcher/app.js` (module) to keep UI code maintainable
- Header menu (`☰`) includes `About This App` and `Readme` (`scripts/test-launcher/README.md`)

```bash
npm run test:e2e:launcher
# Opens at http://127.0.0.1:4173
```

## Network Wait Strategy (Interview Notes)
- We add `page.waitForResponse(...)` at transaction boundaries (register/open account/transfer/bill pay).
- Reason: these are backend state changes, so API confirmation reduces flaky UI timing failures.
- We still keep user-facing assertions (headings, IDs, completion text). API waits do not replace UI checks.
- We avoid adding intercepts to every click to keep tests readable and maintainable.
- Implementation is centralized in `tests/utils/network.ts` via `runTransactionWait(...)` so page objects stay consistent.

Rule of thumb:
- If an action mutates server state, add one network checkpoint plus one UI outcome assertion.

Real bug this caught:
- Transfer flow was intermittently failing with ParaBank `Error! An internal error has occurred`.
- Network checkpoints plus page snapshot showed transfers were sometimes submitted with invalid source/destination setup.
- Fix: in `tests/pages/transfer-funds.page.ts` we explicitly select distinct from/to accounts before submit and validate transfer API response.

## Environment
Defaults are in `config/env.ts`.
Override with env vars when needed:

```bash
BASE_URL="https://parabank.parasoft.com/parabank/index.htm" npx playwright test
```
