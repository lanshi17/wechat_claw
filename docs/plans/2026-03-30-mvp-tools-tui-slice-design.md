# MVP Tool Registry + TUI Slice Design

## Summary

This slice extends the current runnable MVP by filling in the missing tool surface in the tool registry and exposing a slightly richer TUI projection for operators. It intentionally stops short of admin-boundary work, approval-policy changes, or deeper application-loop changes.

## Scope

This slice includes exactly two outcomes:

1. Expand the tool registry from the current `shell.exec` + `web.search` subset to the full MVP tool surface already described by the 2026-03-24 design: `shell.exec`, `fs.read`, `fs.write`, `web.search`, `web.fetch`, `vision.analyze`, and `wechat.reply`.
2. Extend the TUI view-model projection so the operator can see latest per-thread event summaries and a more informative approval queue shape, without building a richer interactive terminal.

## Non-Goals

This slice does not include:

- WeChat admin filtering or trust-boundary changes
- new approval rules or approval UX changes
- real external implementations for web, vision, or WeChat integrations
- changes to the runtime or app loop beyond consuming the existing normalized tool/result contracts
- broader TUI interaction work beyond view-model shape and tests

## Current State

The current repository already has the foundations needed for this slice:

- `src/tools/registry.ts` dispatches only `shell.exec` and `web.search`
- runner modules under `src/tools/*/runner.ts` mostly define partial input types but not a consistent full contract
- `src/tui/app.ts` only projects thread labels and a pending-approval count
- `src/tui/screens/main-screen.ts` and widget files are simple type containers and can absorb richer shapes without UI churn

This makes the next clean slice a contract-normalization task rather than a behavioral rewrite.

## Architecture

### Tool Registry

The registry remains the single normalized dispatch boundary for tool execution. It should accept injected runner dependencies and return a discriminated result per tool with a shared `ok` flag and structured `output` payload.

The key design decision is to normalize each tool contract in the runner modules first, then make the registry a thin dispatcher over those types. This keeps application logic out of the registry and avoids coupling future app/runtime work to ad-hoc result shapes.

Supported tools in this slice:

- `shell.exec`
- `fs.read`
- `fs.write`
- `web.search`
- `web.fetch`
- `vision.analyze`
- `wechat.reply`

Unsupported tool names should still fail with a clear `Unsupported tool: <name>` error.

### Runner Contracts

Runner files should stay lightweight and type-oriented. This slice should define complete input/output types for the missing runners, but should not embed policy or app behavior there.

Representative output expectations:

- `fs.read` returns a path plus file content
- `fs.write` returns a path plus bytes-written summary
- `web.search` returns normalized item summaries
- `web.fetch` returns URL plus readable text
- `vision.analyze` returns a human-readable summary
- `wechat.reply` returns a delivery acknowledgement shape
- `shell.exec` keeps the existing `exitCode/stdout/stderr` structure

These outputs only need to be sufficient for later persistence and projection work; they do not need to model every future detail yet.

### TUI Projection

The TUI remains view-model-driven. Instead of introducing new interactivity, this slice expands the data projected into `buildMainViewModel(...)` and the companion widget/screen types.

The updated view model should include:

- thread items whose labels can include the latest event summary
- approval queue items with enough information to identify the thread and tool clearly
- event-log item typing that can represent a small selected-thread timeline shape

This keeps the TUI useful for smoke observation without forcing a full terminal UI implementation.

## Data Flow

1. Tool runners expose normalized input/output types.
2. `createToolRegistry(...)` accepts the runner dependencies and dispatches by tool name.
3. Registry returns stable result shapes used by later app/runtime code.
4. TUI projection consumes thread + approval data already available from services and emits a richer main-screen state.

No new persistence work is required in this slice.

## Testing Strategy

This slice should be implemented with strict TDD.

### Registry tests

`tests/tools/registry.test.ts` should prove that:

- every supported tool dispatches to the correct injected runner
- returned results preserve the expected tool discriminator and normalized output
- unsupported tool names throw a clear error

### TUI tests

`tests/tui/app.test.ts` should prove that:

- thread labels can include latest event summaries
- pending approval count still projects correctly
- approval items and event-log state are shaped for screen rendering

## Risks and Mitigations

### Risk: Slice becomes a hidden app-loop rewrite

Mitigation: do not touch `src/app/main.ts`, `src/wechat/gateway.ts`, or approval policy files unless a type-only import adjustment is absolutely necessary.

### Risk: Tool contracts become over-engineered

Mitigation: keep each runner contract at MVP size and aligned with existing plan language; prefer one or two essential fields over speculative metadata.

### Risk: TUI scope expands into full rendering work

Mitigation: keep this slice model-oriented. Only adjust state shapes and projection tests.

## Success Criteria

This slice is complete when:

- the registry supports the full MVP tool surface listed above
- registry tests cover dispatch and unsupported-tool behavior
- the TUI view model includes latest-event and richer approval projection
- TUI tests cover the new projection shape
- `npx vitest run tests/tools/registry.test.ts tests/tui/app.test.ts` passes
- the root test suite and typecheck remain green

## Follow-On Work

After this slice lands, the next likely slices are:

1. admin-boundary and approval behavior cleanup in the WeChat/app loop
2. deeper TUI rendering and approval interaction
3. higher-level integration verification across the full MVP flow
