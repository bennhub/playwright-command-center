---
name: playwright-command-center
description: Use this skill when the user wants help analyzing, improving, or extending a Playwright end-to-end automation codebase, designing structured user-flow coverage, or planning migration from a legacy test suite into a more maintainable Playwright architecture. It also applies when the user wants to use the Playwright Command Center patterns in this repo as a reference for QA tooling, execution workflows, or debugging UX.
---

# Playwright Command Center

Use this skill when the task involves Playwright automation architecture, QA tooling workflow design, or test-suite modernization.

## When To Use

Trigger this skill when the user wants to:

- analyze a Playwright automation repo for maintainability, flake, or scaling issues
- improve test structure, folder boundaries, or authoring standards
- design end-to-end coverage from product journeys and business risk
- migrate a legacy or brittle suite into a cleaner Playwright architecture
- study or extend the command-center patterns in this repo for test execution and debugging workflows

Do not use this skill for general frontend work unless the task is clearly tied to test automation or QA workflow design.

## Repo Context

- [README.md](../README.md): project overview and workflow positioning
- [docs/project-pitch.md](../docs/project-pitch.md): short framing for what the project solves
- [docs/example-walkthrough.md](../docs/example-walkthrough.md): example implementation walkthrough
- [docs/cypress-command-center-parity.md](../docs/cypress-command-center-parity.md): parity guide for Cypress adaptation
- `tests/`: example Playwright structure with specs, pages, fixtures, and utilities
- `scripts/test-launcher/`: browser-based launcher UI
- `scripts/command-center.mjs`: terminal dashboard for grouped suite execution

## Supporting Prompt Files

Read only the prompt file that matches the task:

- [codebase-analyzer.md](./codebase-analyzer.md)
Use when the user wants a repository audit, structure review, maintainability assessment, or refactor roadmap.

- [user-flow-analyst.md](./user-flow-analyst.md)
Use when the user wants product journeys translated into prioritized end-to-end scenarios, preconditions, assertions, and test strategy.

- [e2e-migration-coordinator.md](./e2e-migration-coordinator.md)
Use when the user wants to migrate or modernize a legacy suite into a cleaner Playwright structure without losing behavior coverage.

## Workflow

1. Read [README.md](../README.md) if the user needs context on how this repo is structured or what the command center is solving.
2. Determine whether the task is analysis, flow design, migration planning, or QA tooling extension.
3. Open the one supporting prompt file that best matches the task.
4. Ground recommendations in concrete files, patterns, and execution behavior from the codebase.
5. Prefer practical, implementation-ready advice over abstract testing theory.

## Output Style

Prefer QA-lead or senior-automation-engineer style output:

- concrete findings
- specific structure or workflow recommendations
- minimal-change path first
- clear reasoning about reliability, maintainability, and debugging value

When relevant, emphasize:

- stable selectors and deterministic waits
- artifact visibility and failure diagnosability
- test isolation and execution ergonomics
- scaling patterns for specs, page objects, fixtures, and utilities
