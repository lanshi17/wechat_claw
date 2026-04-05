# Operator Approval Flow Design

## Summary

This slice completes the next operator-facing gap in the runnable MVP. It adds an explicit rejection path for approval-required actions, replaces the hardcoded smoke CLI with reusable operator commands, extends the TUI view model so approval decisions and failures are visible, and proves both approve and reject flows through SQLite-backed composition tests.

## Scope

This slice includes exactly five outcomes:

1. Persist rejected approval decisions in both in-memory and SQLite-backed flows.
2. Add an explicit application-level rejection path that never runs the rejected tool action.
3. Replace the hardcoded smoke CLI flow with `message`, `approve`, and `reject` commands.
4. Project approval decisions and failure summaries into the TUI state model.
5. Verify approve and reject flows through repository-backed integration coverage.

## Non-Goals

This slice does not include:

- a real interactive terminal UI
- richer WeChat transport behavior
- provider/runtime redesign
- new tool categories or approval policies
- browser or desktop automation
- multi-user routing changes
- resumable partial plans after rejection

## Current State

The repository already has the basic operator-control loop, but several gaps remain:

- `src/tasks/state-machine.ts` already defines `rejected` as an approval status, but the task-service and repository API only expose approval for the `approved` path
- `src/app/main.ts` supports approval pause and resume, but there is no explicit rejection path
- `src/cli.ts` is still a hardcoded smoke script rather than a reusable operator interface
- `src/tui/app.ts` and related widgets only project pending approvals and event summaries, not approval decisions or failure-specific thread context
- `tests/app/entrypoint.test.ts` proves repository-backed approval and reuse behavior, but it does not yet pin the reject branch of the operator lifecycle

## Architecture

### Approval Decision Model

Approval records should continue using the existing `pending | approved | rejected` state model. Thread state should remain narrow:

- approved path completes the stored action and moves the thread to `done`
- rejected path does not run the stored action and moves the thread to `failed`

The rejection path should optionally carry an operator note. That note should be persisted indirectly through task events and surfaced in operator-facing output; this avoids broadening the approval storage schema before there is a stronger need for a first-class rejection-reason column.

### Repository and Task-Service Boundary

`ApprovalRepository` should add `markRejected(approvalId)` so SQLite-backed approvals can persist the decision. `TaskService` should expose `markRejected(approvalId)` with the same semantics in both in-memory and repository-backed modes.

The task service should stay small. It does not need a new approval aggregate or generalized workflow engine. The service only needs to:

- update approval status
- expose the stored approval for approve or reject
- append events and update thread status through the existing APIs

### Application Loop

`createApplication(...)` should gain an explicit `rejectApproval(approvalId, reason?)` method. The application layer already owns operator orchestration, so it is the correct place to:

- load the stored approval
- mark it rejected
- append an `approval.rejected` event
- mark the thread failed with a rejection summary
- send a final reply that tells the operator the action was rejected

`resumeApproval(...)` should remain approve-only. Separating approve from reject keeps each operator decision path small and testable.

### CLI Surface

`src/cli.ts` should become a command-driven entrypoint instead of a scripted smoke loop.

The supported commands should be:

- `message <text...>`: bootstrap the app and submit one admin message
- `approve <approvalId>`: bootstrap the app, approve the stored approval, resume execution, and print the final thread status
- `reject <approvalId> [reason...]`: bootstrap the app, reject the stored approval, and print the final failed status

The CLI should reuse the existing composed runtime from `bootstrapApplication(...)` rather than adding a separate control path.

### TUI State Projection

The current TUI layer is a view-model projection, not a real renderer. This slice should keep it that way and extend only the state model:

- approval items should include approval status
- thread labels should include the latest rejection or failure summary when present
- event items should surface `approval.rejected` and `thread.failed`

This gives later rendering work enough structure without introducing a full interactive UI.

## Data Flow

### Approve path

1. Operator submits `message ...`.
2. App plans a risky action and creates a pending approval.
3. Operator submits `approve <approvalId>`.
4. App marks the approval approved, runs the stored action, appends completion output, marks the thread done, and sends the stored reply.

### Reject path

1. Operator submits `message ...`.
2. App plans a risky action and creates a pending approval.
3. Operator submits `reject <approvalId> [reason...]`.
4. App marks the approval rejected, appends an `approval.rejected` event, marks the thread failed, and sends a final rejection reply without running the tool.

## Testing Strategy

This slice should be implemented with strict TDD and small story-sized steps.

### Repository and task-service tests

- `tests/store/approvals.test.ts` should prove rejected approvals persist in SQLite
- `tests/tasks/service.test.ts` should prove in-memory and repository-backed services can reject stored approvals

### Application tests

- `tests/app/main.test.ts` should prove the reject path never executes `tools.run(...)`
- rejection should append `approval.rejected` and `thread.failed` outcomes and send a final operator-facing reply

### CLI tests

- add focused CLI tests that prove `message`, `approve`, and `reject` command parsing and orchestration
- the tests should avoid network or real WeChat dependencies by using the existing composed boundaries or minimal seams

### TUI tests

- `tests/tui/app.test.ts` should cover rejected approval items and failed-thread summaries

### Composition tests

- `tests/app/entrypoint.test.ts` should prove both approve and reject flows against SQLite-backed state

## Risks and Mitigations

### Risk: Rejection reason handling grows into a schema rewrite

Mitigation: keep the reason in event summaries and operator output for this slice. Do not add a new DB column unless tests show it is required.

### Risk: CLI rewrite broadens into a separate runtime

Mitigation: keep `src/cli.ts` as a thin argument parser over `bootstrapApplication(...)` and the existing app/task-service APIs.

### Risk: TUI work expands into renderer implementation

Mitigation: restrict changes to view-model and widget state types only.

### Risk: Approve and reject logic diverge across layers

Mitigation: keep approval-state mutation in task service / repository boundaries, and keep orchestration outcomes in the application layer.

## Success Criteria

This slice is complete when:

- approval status can move from `pending` to `rejected` in both in-memory and SQLite-backed flows
- rejected approvals never execute the stored tool action
- the CLI exposes reusable `message`, `approve`, and `reject` commands
- TUI state projection includes approval decisions and failed-thread summaries
- repository-backed entrypoint tests cover both approve and reject lifecycles
- focused tests, full tests, and typecheck are green

## Follow-On Work

After this slice lands, the next likely work becomes:

1. real interactive TUI approval actions
2. richer artifact and thread-history presentation
3. stronger runtime/provider error recovery and operator diagnostics
