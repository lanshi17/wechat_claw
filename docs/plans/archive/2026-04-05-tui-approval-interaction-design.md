# TUI Approval Interaction Design

## Summary

This slice upgrades the current view-model-only TUI into a minimal interactive operator console. It adds a zero-dependency keyboard loop over `stdin`/`stdout`, lets the operator navigate pending approvals, approve a selected item directly, and reject with a one-line reason input while reusing the existing application-level approve/reject logic.

## Scope

This slice includes exactly five outcomes:

1. Add task-service query APIs needed to project threads, approvals, and events into a live TUI.
2. Add a small TUI controller/runtime with keyboard navigation and reject-input mode.
3. Render the current main-screen state as plain text using `stdout`, without introducing a third-party TUI framework.
4. Expose the interactive TUI from the CLI as a new operator command.
5. Cover the controller state transitions and command wiring with focused tests.

## Non-Goals

This slice does not include:

- a full curses/blessed/ink-style terminal framework
- mouse interaction
- multi-pane scrolling history
- live WeChat transport integration
- richer artifact previewing
- background refresh threads or async polling
- provider/runtime redesign

## Current State

The repository already has the ingredients for an operator console, but not the interaction loop:

- `src/tui/app.ts` builds a static view model from thread, approval, and event inputs
- `src/tui/screens/main-screen.ts` and widget files define state shapes only
- approval decisions can already be executed through `app.resumeApproval(...)` and `app.rejectApproval(...)`
- `src/cli.ts` already exposes `message`, `approve`, and `reject`, but there is no `tui` command
- `TaskService` exposes point lookups such as `getThread(...)`, `getPendingApproval(...)`, and `listEvents(threadId)`, but it does not yet expose list queries for all threads or all approvals needed by a live screen

## Architecture

### Query Boundary

The TUI should not reach into repositories directly. It should read everything through `TaskService` so the in-memory and SQLite-backed modes stay aligned.

To support this, `TaskService` should add small query helpers:

- `listThreads()`
- `listApprovals()`
- `listEvents(threadId)` should remain the event query entrypoint

These helpers should stay read-only and deterministic. The service should not start building UI-specific structures.

### TUI Runtime

Add a small runtime/controller layer, for example `src/tui/runtime.ts`, that owns:

- current `mode`: `browse` or `reject_input`
- current selected approval index
- current reject-reason buffer
- key handling and action dispatch

This runtime should not contain business decisions about approvals. It should only:

- choose which approval is selected
- decide when to enter/exit input mode
- call existing app methods for approve or reject
- refresh the screen model after each action

### Rendering

Rendering should remain minimal and plain-text. A single render function can:

- print thread list
- print approval list with a visible selected row marker
- print event summaries for the selected approval’s thread
- print a footer showing available keys and current mode
- print a single-line input prompt when in reject-input mode

No ANSI-heavy layout system is required for this slice. Basic line-based output is enough.

### Keyboard Interaction

The runtime should support:

- `j` / `k` and arrow keys to move selection
- `a` to approve the selected pending approval
- `r` to enter reject-input mode for the selected pending approval
- character input while in reject-input mode
- `Backspace` to edit the reject reason
- `Enter` to submit rejection
- `Esc` to cancel reject-input mode
- `q` to quit

If there are no pending approvals, approve and reject actions should be ignored and the footer should explain that nothing is selectable.

### CLI Integration

The CLI should gain a `tui` command that:

- bootstraps the application
- loads the current task-service/app references
- starts the TUI runtime

The existing `message`, `approve`, and `reject` commands should remain unchanged.

### Data Flow

1. Operator runs `wechat-claw tui`.
2. CLI bootstraps the app and creates the TUI runtime.
3. Runtime reads thread/approval/event state from `TaskService`.
4. Runtime renders the main screen and waits for key input.
5. Operator navigates to an approval and presses `a` or `r`.
6. Runtime calls `app.resumeApproval(...)` or `app.rejectApproval(...)`.
7. Runtime refreshes task-service data and re-renders the updated screen.

## Testing Strategy

This slice should be implemented with strict TDD.

### Task-service query tests

Extend service tests to prove:

- `listThreads()` returns current threads in stable order
- `listApprovals()` returns current approvals and their statuses in stable order

### TUI controller tests

Add focused tests for the runtime/controller that prove:

- selection moves up and down within bounds
- approve triggers `resumeApproval(...)` for the selected approval
- reject enters input mode, edits the buffer, and triggers `rejectApproval(...)` with the typed reason
- `Esc` exits reject-input mode without dispatching

These tests should drive controller methods or a reducer-like API rather than relying on real terminal I/O.

### CLI integration tests

Extend CLI tests to prove:

- `tui` bootstraps the app and starts the TUI runtime
- existing subcommands still work unchanged

### Verification

Keep the final verification set at:

- focused TUI/controller/CLI/service tests
- full `npm test`
- `npx tsc --noEmit`

## Risks and Mitigations

### Risk: Slice expands into a full terminal framework

Mitigation: keep rendering line-based and controller-focused. No dependency addition, no layout engine.

### Risk: TUI starts duplicating application logic

Mitigation: TUI may only call `app.resumeApproval(...)` and `app.rejectApproval(...)`; it must not mutate approval state directly.

### Risk: Query APIs leak repository details into the UI

Mitigation: return small, normalized records from `TaskService`; keep view-model assembly in `src/tui/app.ts`.

### Risk: Raw key handling becomes brittle

Mitigation: isolate input decoding from controller state transitions so the core behavior is testable without a terminal.

## Success Criteria

This slice is complete when:

- task-service can list threads and approvals for the current operator view
- a zero-dependency TUI runtime supports selection, approve, and reject-with-reason
- the CLI exposes a `tui` command
- controller and CLI tests cover the new interaction flow
- full tests and typecheck remain green

## Follow-On Work

After this slice lands, the next likely work becomes:

1. richer thread-history scrolling and artifact previews
2. periodic refresh and better operator observability
3. eventually replacing the minimal renderer with a richer TUI framework only if needed
