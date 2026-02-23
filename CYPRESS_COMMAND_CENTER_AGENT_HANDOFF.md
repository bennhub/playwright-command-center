# Cypress Command Center - Agent Handoff Guide

## Objective
Rebuild the same "Command Runner + Debugger" experience from the Playwright command center, but for a Cypress-based repo.

This is a **parity implementation** request:
- same workflow model
- same UX patterns
- same confidence/debug productivity outcomes

Do not ship a simplified MVP unless blocked by hard Cypress limitations.

---

## Product Goal
Create a local command center app that eliminates command-line friction, standardizes run workflows, and speeds failure analysis for Cypress tests.

Desired outcomes:
- one-click execution for common run modes
- global checklist execution for selected specs
- run history + live logs
- one-click artifact access (screenshots/videos/reports)
- menu-based in-app documentation (About + Readme)

---

## Non-Negotiable Experience Parity
The Cypress app must preserve these interaction patterns from the Playwright app:

1. Header and navigation
- Hamburger menu next to app title
- Menu items:
  - About This App
  - Readme
- About opens modal with workflow bullets
- Readme opens in-app modal code window (markdown text)

2. Global action area
- Separate "Global Actions" container above run context controls
- Buttons:
  - Rerun Last Failed
  - Open History Report
  - Open Latest Report (if reporter enabled)
  - View Latest Video (Global)
  - Stop all

3. Target selector
- Label: `Target (Browser/Device)`
- Cypress mapping examples:
  - chrome
  - electron
  - edge

4. Global Spec Cart
- Checklist of discovered specs
- Select All / Deselect All
- Shared command buttons panel (avoid per-card command duplication)
- `Run Selected Suite + Report` single-command run for consolidated outputs

5. Spec List (Artifacts)
- Per-spec cards below global cart
- Per-spec actions:
  - View Latest Video (This Test)
  - View Latest Screenshot (or "Latest Failure Screenshot")
  - View Latest Report Segment (optional, reporter-dependent)

6. Right panel
- Run History panel (status + duration)
- Live Log panel streaming stdout/stderr

7. Dynamic spec detection
- Auto-refresh spec lists when spec files added/removed
- Polling is acceptable (e.g., every 8s)
- If run active: queue update and apply when idle
- Show small badge text (e.g., "Update queued", "Updated")

---

## Technical Architecture (Keep Similar)

### Backend
- Node server script (single file is acceptable)
- Endpoints for:
  - static UI files
  - run commands
  - suite runs
  - status/history/log streams
  - artifact/report fetch
  - readme/about content
- SSE for live events:
  - status
  - history
  - log

### Frontend
- Static `index.html` + `app.js` module
- No heavy frontend framework required
- Keep CSS simple and intentional; preserve layout clarity

### Process model
- Spawn Cypress CLI processes with `child_process.spawn`
- Single active-run guard
- `Stop all` sends SIGINT
- History entries per run command with timestamps/duration

---

## Cypress Mapping

### Spec discovery
Use repo-appropriate spec location from Cypress config (`cypress.config.*`):
- typically `cypress/e2e/**/*.cy.{js,ts,jsx,tsx}`

### Command presets (minimum)
Implement as shared global buttons:

1. `Open Interactive`
- `npx cypress open`
- optionally pass `--e2e --browser <target>`

2. `Headless Run`
- `npx cypress run --e2e --browser <target> --spec <spec>`

3. `Headed Run`
- `npx cypress run --e2e --browser <target> --headed --spec <spec>`

4. `Repeat x3`
- run same spec 3 times sequentially (or `cypress-repeat` if already adopted)

5. `Record Mode` (optional if project supports)
- include only when Cypress Cloud setup exists

6. `Run Selected Suite + Report`
- single command including all selected specs in one invocation
- ensure consolidated report generation if reporter enabled

### Artifact paths
Default Cypress outputs:
- videos: `cypress/videos`
- screenshots: `cypress/screenshots`

Implement:
- latest global video lookup
- latest per-spec video lookup
- latest per-spec screenshot lookup

### Reports
Reporter support varies by repo.
Implement adaptable strategy:
- If mochawesome/allure/html reporter configured: open report endpoint
- If not configured: gracefully show "report unavailable" message

---

## Required API Contract (Suggested)

### Read endpoints
- `GET /` -> UI
- `GET /app.js` -> frontend module
- `GET /api/specs` -> specs, targets, presets
- `GET /api/status` -> active run state
- `GET /api/history` -> run history + last failed
- `GET /api/logs` -> buffered logs
- `GET /api/stream` -> SSE
- `GET /api/artifact-status?spec=...`
- `GET /video/latest`
- `GET /artifact/latest/video?spec=...`
- `GET /artifact/latest/screenshot?spec=...`
- `GET /api/report-status`
- `GET /report` (if available)
- `GET /repo-readme`

### Write endpoints
- `POST /api/run` -> run one preset on one spec
- `POST /api/run-suite` -> run selected specs in one command
- `POST /api/rerun-last-failed`
- `POST /api/stop`

---

## History Data Model (Minimum)
Each run entry should include:
- `id`
- `spec` (or suite label)
- `target`
- `presetId`
- `presetTitle`
- `command`
- `startedAt`
- `endedAt`
- `durationMs`
- `status` (`running` / `passed` / `failed`)
- `exitCode`
- `signal`

---

## UI Copy / Labels (Keep Consistent)
Use these labels unless org-specific branding requires change:
- Title: `Cypress Command Runner + Debugger`
- Section: `Global Actions`
- Section: `Global Spec Cart`
- Section: `Execute On Selected`
- Section: `Spec List (Artifacts)`
- Section: `Run History`
- Section: `Live Log`
- Label: `Target (Browser/Device)`

---

## Acceptance Criteria
Implementation is done when all are true:

1. Startup
- UI loads at localhost and shows specs dynamically from repo

2. Execution
- User can run selected specs via shared preset buttons
- User can run a selected suite in one command
- Stop all works safely

3. Feedback
- Live logs stream while running
- Status updates correctly
- Run history updates with duration/status

4. Artifacts
- Global and per-spec video retrieval works
- Per-spec screenshot retrieval works
- Report button gracefully handles available/unavailable states

5. Robustness
- Dynamic spec auto-refresh works
- No forced page refresh needed for spec add/remove
- Mid-run spec changes are queued and applied when idle

6. UX
- Hamburger menu with About + Readme modal exists
- Layout mirrors command-center pattern from Playwright version

---

## Suggested Implementation Order
1. Static UI skeleton + sections
2. `/api/specs` + dynamic list rendering
3. Run endpoint + live logs SSE
4. History model + rerun-last-failed
5. Global suite run endpoint
6. Artifact endpoints (video/screenshot)
7. Report support + graceful fallback
8. Menu/modals + readme route
9. Dynamic spec polling + queued apply
10. Final polish + docs

---

## Notes for Agents
- Keep this lightweight; avoid overengineering.
- Preserve naming/interaction consistency to reduce retraining.
- Do not introduce destructive git actions.
- If Cypress reporter setup is missing, implement clear "unavailable" messaging rather than breaking UI.

---

## Deliverables
- `scripts/cypress-command-center/server.mjs` (or equivalent)
- `scripts/cypress-command-center/index.html`
- `scripts/cypress-command-center/app.js`
- Command in `package.json` to start center
- README section documenting usage and capabilities
- Optional: `INTERVIEW_PITCH_NOTES_CYPRESS.md`

