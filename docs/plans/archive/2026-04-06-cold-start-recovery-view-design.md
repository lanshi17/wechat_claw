# Cold-Start Recovery View Design

## Summary

This slice makes restart recovery visible to the operator without changing runtime behavior. When the process restarts and the operator launches `wechat-claw tui`, the screen should project the current SQLite-backed approval and thread state as an explicit recovery scene: pending approvals remain actionable, stalled `waiting_approval` threads remain visible, and failed threads remain inspectable. The system must not auto-resume any work.

## Scope

This slice includes exactly five outcomes:

1. Detect cold-start recovery conditions from the existing durable read model.
2. Render explicit recovery messaging in the main TUI screen instead of relying on the operator to infer it from raw lists.
3. Show thread event context even when there is no selected pending approval by falling back to a recoverable thread.
4. Keep operator actions limited to the existing approve and reject flows for pending approvals.
5. Prove that restarting against the same SQLite database yields the same operator recovery view.

## Non-Goals

This slice does not include:

- automatic resumption of approvals or tool execution
- rebuilding planner/runtime session state such as `currentMessage` or `currentThreadId`
- a new `status`, `recover`, or other CLI command beyond the existing `tui`
- background polling or refresh loops
- richer multi-pane navigation or independent thread selection controls
- a new recovery repository or service layer
- provider/runtime retry policy changes

## Current State

The repository already persists the state needed for a recovery-oriented operator view:

- `TaskService` can list repository-backed threads, approvals, and events
- `src/cli.ts` already exposes a `tui` command
- `src/tui/runtime.ts` re-reads task-service state on each render
- `src/app/main.ts` already supports approve and reject paths against persisted approval records
- `tests/app/entrypoint.test.ts` already proves a recreated entrypoint can approve or reject a persisted approval by ID

The remaining gap is presentation and operator orientation after restart:

- the TUI does not explicitly indicate that the current screen is a recovered scene
- the event pane is currently tied to the selected approval thread, so a cold start with no pending approvals can lose thread context entirely
- `waiting_approval` and `failed` threads appear in the thread list, but the screen does not explain what action, if any, the operator should take next

## Architecture

### Recovery Semantics

Cold-start recovery should remain a pure read-model concept. No new runtime state machine is needed.

The TUI should treat the following durable states as recovery signals:

- one or more `pending` approvals: primary recovery work that the operator can continue immediately
- no `pending` approvals, but one or more `waiting_approval` threads: stalled recovery context that should remain visible
- one or more `failed` threads: informational recovery context that should remain inspectable

The screen should only enter recovery messaging when at least one of those conditions is true.

### Read Boundary

This slice should reuse the existing `TaskService` query boundary:

- `listThreads()`
- `listApprovals()`
- `listEvents(threadId)`

The TUI should derive recovery state from those existing queries instead of introducing:

- a bootstrap-time recovery snapshot
- a repository-facing recovery service
- a second copy of recovery logic inside `src/app/entrypoint.ts`

If implementation exposes a tiny helper for tests, it should remain a pure projection helper and not become a new application boundary.

### TUI Projection

Recovery projection should stay inside the TUI layer, centered on `src/tui/app.ts` and `src/tui/runtime.ts`.

The screen state should gain enough information to render:

- a recovery banner or headline when durable recovery work exists
- a footer/help string that distinguishes actionable pending approvals from informational recovered context
- a selected thread context even when no pending approval is currently selected

No new interactive mode is required. The existing browse and reject-input modes remain sufficient.

### Selected Thread Fallback

The event pane should use a deterministic fallback order:

1. the thread linked to the currently selected pending approval
2. otherwise, the most recent `waiting_approval` thread
3. otherwise, the most recent `failed` thread
4. otherwise, no selected thread context

This keeps the event pane useful after restart without introducing separate thread navigation in this slice.

### Entrypoint and Bootstrap

`src/app/bootstrap.ts` and `src/app/entrypoint.ts` should keep their current responsibility:

- load config
- connect to the configured SQLite database
- create repository-backed `TaskService`
- expose the existing app and TUI runtime dependencies

They should not attempt to reconstruct runtime-only variables or automatically continue work on boot.

## Data Flow

1. The operator runs `wechat-claw tui`.
2. CLI bootstraps the application through the existing bootstrap and entrypoint path.
3. Entrypoint connects to the configured SQLite database and creates repository-backed services.
4. TUI runtime reads threads, approvals, and events through `TaskService`.
5. TUI projection derives recovery signals from durable state.
6. Screen renders a recovery banner, current help text, and selected thread context.
7. If pending approvals exist, the operator may continue using the existing `a` and `r` actions.
8. If no pending approvals exist, the screen remains browse-only and does not auto-dispatch anything.

## Testing Strategy

This slice should remain TDD-driven and focused on projection behavior.

### TUI projection tests

Extend `tests/tui/app.test.ts` to prove:

- pending approvals render an explicit cold-start recovery message
- a `waiting_approval` thread with no pending approval still surfaces thread-event context
- failed-only recovery state renders informational messaging without implying an approve/reject action

### TUI runtime tests

Extend `tests/tui/runtime.test.ts` to prove:

- initial render uses the selected approval thread when pending approvals exist
- initial render falls back to a `waiting_approval` thread when approvals are absent
- initial render falls back to a `failed` thread when neither selection nor waiting approvals exist

### Entrypoint composition tests

Extend `tests/app/entrypoint.test.ts` to prove:

- a writer entrypoint can persist a recoverable scene to SQLite
- a recreated reader entrypoint using the same database produces the same recovery-oriented TUI state

No new provider, gateway, or CLI command coverage is needed unless a minimal seam is required by implementation.

## Risks and Mitigations

### Risk: The slice turns into session reconstruction

Mitigation: recovery remains a TUI projection over durable state only. No planner inputs, no tool replay, no runtime-variable restoration.

### Risk: Recovery messaging becomes misleading on ordinary idle state

Mitigation: only render recovery messaging when at least one approval is pending or at least one thread is `waiting_approval` or `failed`.

### Risk: Event context remains empty after restart

Mitigation: use deterministic thread fallback when no approval is selected.

### Risk: TUI grows a second selection model

Mitigation: keep a single approval-based selection model and only add read-only thread fallback for the event pane.

## Success Criteria

This slice is complete when:

- `wechat-claw tui` shows explicit recovery messaging after restart when SQLite contains pending approvals or unfinished failure context
- pending approvals remain actionable through the existing TUI controls
- `waiting_approval` and `failed` threads remain visible and inspectable after cold start
- the event pane keeps useful context even when no pending approval is selected
- focused tests, full tests, and typecheck remain green

## Follow-On Work

After this slice lands, the next likely work becomes:

1. periodic refresh and stronger operator diagnostics for long-running sessions
2. richer thread-history browsing and artifact previews
3. eventually, a separate status or recovery command only if operators need non-interactive inspection
