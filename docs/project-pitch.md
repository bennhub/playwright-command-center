# Playwright Command Center Pitch

## One-Line Pitch

I built Playwright Command Center to remove command-line friction, standardize test execution, and speed up failure analysis during automation work.

## Problem It Solves

- Teams lose time remembering and typing long test/debug commands.
- Debugging becomes inconsistent across engineers when everyone uses different flags and workflows.
- Failure triage is slower when traces, videos, and reports are not easy to access.
- Demo and walkthrough flow gets messy when switching between terminal commands and multiple artifact tools.

## What I Built

A local command center UI that provides:

- a global spec checklist with select/deselect controls
- one-click command presets such as Debug, Headed, Headless, UI Mode, Trace, Video, Reporter, and Repeat
- single-command suite runs for consolidated HTML report output
- per-test artifact actions for latest video and trace
- global actions for rerunning last failed, opening the latest report or video, stopping all runs, and viewing history
- run history with status and duration
- dynamic spec detection when specs are added or removed

## Why It Matters

- Faster feedback loops: less time fighting commands, more time validating behavior
- Lower onboarding friction: new engineers can run and debug tests without memorizing flags
- Better debugging quality: traces, videos, reports, and history are part of the normal workflow
- Cleaner demos: the test runner experience is more consistent and presentable

## Good Talking Points

- "I removed command lookup and typing overhead from every debug cycle."
- "I reduced context switching between terminal, report, trace viewer, and artifacts."
- "I turned repeat workflows like rerun-last-failed and suite reporting into one-click actions."

## Technical Decisions Worth Mentioning

- Lightweight implementation using Node plus static HTML and JavaScript
- API-driven UI for run actions, artifacts, history, and status
- Safe runtime behavior with queued spec-list updates while tests are running
- Per-test artifact lookup to avoid confusion in multi-test runs
- Extensible structure for future launcher features

## Engineering Behaviors Demonstrated

- product thinking: solved workflow pain, not just test implementation
- developer-experience focus: optimized discoverability and speed
- reliability focus: cleaner execution flow and safer state handling
- observability mindset: traces, videos, history, and reports all integrated

## Short Demo Script

1. Show the Global Spec Cart and quick selection flow.
2. Run `Debug` or `UI Mode` for one spec.
3. Open the trace or video for that test.
4. Run `Run Selected Suite + Report` and open the consolidated report.
5. Trigger `Rerun Last Failed` from history.

## Future Extensions

- isolated PR or MR review runs in a temporary workspace
- AI-assisted review mode using changed files plus test artifacts
- saved command profiles per role
- CI run ingestion and trend views
- exportable session recap for review or standup use
