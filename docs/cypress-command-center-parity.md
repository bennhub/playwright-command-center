# Cypress Command Center Parity Guide

## Objective

Rebuild the same command center experience from this Playwright project for a Cypress-based repo.

This is a parity implementation request:

- same workflow model
- same UX patterns
- same debugging and productivity goals

Do not reduce it to a simplified MVP unless Cypress limitations force a specific compromise.

## Product Goal

Create a local command center app that removes command-line friction, standardizes run workflows, and speeds failure analysis for Cypress tests.

Desired outcomes:

- one-click execution for common run modes
- global checklist execution for selected specs
- run history and live logs
- one-click artifact access for screenshots, videos, and reports
- menu-based in-app documentation

## Experience Parity Requirements

The Cypress version should preserve these interaction patterns:

1. Header and navigation
- hamburger menu beside the app title
- `About This App` and `Readme` menu items

2. Global actions
- `Rerun Last Failed`
- `Open History Report`
- `Open Latest Report`
- `View Latest Video (Global)`
- `Stop all`

3. Target selector
- labeled `Target (Browser/Device)`
- examples: `chrome`, `electron`, `edge`

4. Global Spec Cart
- discovered-spec checklist
- Select All and Deselect All
- shared command buttons
- `Run Selected Suite + Report`

5. Spec artifact area
- per-spec video and screenshot access
- optional per-spec report link if supported

6. Right panel
- Run History
- Live Log

7. Dynamic spec detection
- auto-refresh or polling
- queue updates while a run is active

## Technical Shape

### Backend

- lightweight Node server
- endpoints for runs, status, history, logs, artifacts, reports, and docs
- SSE for status, history, and log updates

### Frontend

- static `index.html` plus `app.js`
- no heavy framework required

### Process Model

- use `child_process.spawn` for Cypress CLI commands
- enforce single active run
- `Stop all` should send `SIGINT`
- record run history with timestamps and duration

## Cypress Mapping

### Spec Discovery

Use the repo’s Cypress config, typically:

- `cypress/e2e/**/*.cy.{js,ts,jsx,tsx}`

### Command Presets

- `Open Interactive`
- `Headless Run`
- `Headed Run`
- `Repeat x3`
- `Record Mode` if Cypress Cloud exists
- `Run Selected Suite + Report`

### Artifacts

Default Cypress paths:

- `cypress/videos`
- `cypress/screenshots`

Implement:

- latest global video lookup
- latest per-spec video lookup
- latest per-spec screenshot lookup

### Reports

If a report is configured, open it. If not, fail gracefully with a clear message.

## Acceptance Criteria

Implementation is done when:

- the UI loads and shows specs dynamically
- selected specs can run through shared presets
- suite execution works
- logs and status update live
- history records duration and status
- artifacts are easy to access
- spec auto-refresh works without page reload
- the app preserves the same command-center feel as the Playwright version

## Implementation Order

1. UI skeleton and layout
2. spec discovery endpoint
3. run endpoint and live logs
4. history and rerun-last-failed
5. suite execution
6. artifact access
7. report support
8. menu modals
9. dynamic spec refresh
10. polish and docs
