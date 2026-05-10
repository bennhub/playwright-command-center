# Example Walkthrough

## 60-Second Version

"I built a Playwright automation project around ParaBank using page objects, fixtures, and a local command center for faster execution and debugging. I scoped execution to `chromium` and `mobile-chrome` to keep desktop and mobile coverage without adding unnecessary browser noise.

For state-changing flows like registration, account creation, transfers, and bill pay, I added transaction-boundary network waits. That reduced flaky timing failures and improved diagnostics. A real issue this exposed was intermittent transfer failure caused by invalid source and destination account setup. I fixed that by explicitly selecting distinct accounts before submit.

The result is not just a set of tests, but a more usable QA workflow with clearer debugging, better artifacts, and faster rerun loops."

## What Changed And Why

### 1. Framework And Scope

- Built a clean structure with specs, pages, fixtures, utilities, config, and supporting scripts
- Scoped execution to `chromium` and `mobile-chrome`
- Kept the example focused on high-value flows rather than broad browser-matrix coverage

### 2. High-Value Flows

- register and login
- negative login
- open account
- transfer funds
- bill pay
- API observability

### 3. Flake Hardening

- Added shared helper `runTransactionWait(...)` in `tests/utils/network.ts`
- Centralized response matching, timeout handling, and status validation
- Reused the pattern across state-changing page objects

### 4. Real Bug Exposed

- Transfer flow intermittently failed with ParaBank internal error
- Root cause was invalid account pairing during transfer
- Fixed by explicitly selecting distinct source and destination accounts before submit

### 5. Registration Reliability

- Improved username generation to reduce collisions
- Added retry behavior for existing usernames under repeated runs

### 6. Workflow Layer

- Added terminal command center for grouped suite execution
- Added browser-based launcher UI for one-click execution and artifact access
- Added clearer docs for why network-aware waiting was used

## How To Demo

1. `npm run test:e2e:ui`
2. `npm run test:e2e:dashboard`
3. `npm run test:e2e:launcher`
4. `npm run test:e2e:report`

## Talking Points For Network Waits

- not for every click
- used when backend state actually changes
- paired with user-visible assertions rather than replacing them
