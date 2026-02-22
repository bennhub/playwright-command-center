# Parabank Showcase Study Notes

## 60-Second Version
"I built a Playwright automation showcase for Parabank using page objects, fixtures, and CI. I scoped execution to `chromium` and `mobile-chrome` so we keep desktop plus mobile coverage without multi-browser noise.  
I added transaction-boundary network waits for state-changing actions like register, open account, transfer, and bill pay. This reduced flaky timing failures and improved diagnostics.  
A real issue this uncovered was transfer intermittently hitting Parabank internal error because source and destination accounts were not reliably distinct; I fixed that by explicitly selecting different accounts before transfer.  
I also added username-collision resilience in registration and a lightweight command-center script to run grouped suites in parallel with live status and logs. The full matrix now passes consistently."

## Longer Walkthrough (What We Changed and Why)

### 1. Framework and Scope
- Built clean structure: specs/pages/fixtures/utils/config/CI.
- Decided target matrix = `chromium` + `mobile-chrome`.
- Why: keeps mobile importance while avoiding cross-browser instability from Firefox/WebKit in this showcase phase.

### 2. High-Value Flows
- `01` register/login
- `02` negative login
- `03` open account
- `04` transfer funds
- `05` bill pay
- `06` API observability

### 3. Flakiness Hardening
- Added shared helper `runTransactionWait(...)` in `tests/utils/network.ts`.
- Centralized response matching by URL/method, timeout, and status assertions.
- Refactored page objects to use helper:
  - `tests/pages/auth.page.ts`
  - `tests/pages/open-account.page.ts`
  - `tests/pages/transfer-funds.page.ts`
  - `tests/pages/bill-pay.page.ts`
- Why: one consistent pattern instead of duplicated `waitForResponse` logic everywhere.

### 4. Real Bug Intercepts Exposed
- Transfer flow sometimes landed on "Error! An internal error has occurred."
- Root issue: transfer could submit invalid account pairing.
- Fix: explicitly select distinct from/to accounts before clicking transfer.
- Result: transfer became deterministic and passed on both desktop/mobile.

### 5. Registration Reliability
- Username generation improved with short random-first format to avoid truncation collisions.
- Added retry-on-"username already exists" in registration flow.
- Why: Parabank occasionally collides even with generated names under repeated runs.

### 6. Demo and Ops
- Added command center: `npm run test:e2e:dashboard`
- Runs grouped suites in parallel with terminal dashboard + worker logs.
- Added README interview notes and "why network waits" guidance.

## How to Demo Live
1. `npm run test:e2e:ui`
2. `npm run test:e2e:dashboard`
3. `npx playwright show-report`

## Talking Points for Intercepts
- Not for every click.
- Use on backend state-changing actions.
- Keep both checks:
  - API checkpoint (network)
  - User-visible outcome (UI assertion)
