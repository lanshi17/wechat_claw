# Approval Resume Smoke Slice Design

## Summary

Add the smallest approval-required execution path on top of the newly landed runnable smoke MVP. The goal of this slice is to preserve the current happy-path smoke loop while making one `approval_required` action pause execution, create an in-memory approval request, emit an approval-needed reply, and then resume the same thread when a simulated CLI approval command is provided.

## Why This Slice

The repository now has a runnable smoke path via `start:mvp`, but the orchestration boundary still only supports auto-approved actions. In `src/app/main.ts`, actions with `decision: "approval_required"` are effectively skipped instead of being represented as pending work.

That means the current runtime proves only half of the intended loop:

1. message enters the app
2. runtime produces actions
3. auto-approved tool runs
4. thread completes

The next highest-value gap is therefore not persistence or a real HTTP provider. It is the first true pause/resume behavior for risky actions.

## Product Goal for This Slice

A local developer should be able to run a smoke flow that demonstrates:

1. a trusted admin message enters the app
2. runtime produces an action that requires approval
3. the app creates an approval request and pauses the thread
4. the CLI prints the approval ID and does not run the risky tool yet
5. a simulated `approve <approvalId>` command resumes that exact action
6. the tool executes
7. the thread records completion events and emits a final reply

## Scope

### In Scope

- represent approval requests in memory
- extend the task/app flow to pause on `approval_required`
- add a way to look up and approve a pending request
- resume execution of the stored action after approval
- expose the approval ID clearly in the smoke output
- extend the smoke CLI so one run can demonstrate both the pause and the resume path
- add focused tests for approval request creation and approve-to-resume completion

### Out of Scope

- SQLite-backed approval persistence
- multiple concurrent approvals in one thread beyond basic in-memory support
- reject/edit approval branches
- TUI approval queue rendering
- restart recovery
- real WeChat reply transport
- real OpenAI-compatible HTTP calls

## Recommended Approach

### Chosen Approach

Use an in-memory approval store attached to the task service (or a tightly coupled in-memory approval structure next to it), and keep the orchestration logic in `src/app/main.ts`.

When an action is classified as `approval_required`, the app should:

- create a pending approval record with a generated `approvalId`
- append an `approval.requested` event to the thread
- emit a reply that includes the approval ID and a short action summary
- stop processing the thread at that point

When a later approval decision arrives, the app should:

- look up the pending approval by `approvalId`
- mark it approved
- execute the stored action through the existing tool registry
- append `tool.completed` and completion events
- mark the thread done
- emit the final reply

### Alternatives Considered

#### 1. Event-only reconstruction of approval state

Rejected for now because it would push this slice toward a more complex event-sourcing design before the basic pause/resume UX is proven.

#### 2. SQLite-backed approval repository now

Rejected because it would couple this slice to persistence work and enlarge scope. Persistence is a clean follow-up once the in-memory behavior is correct.

#### 3. Full TUI operator interaction now

Rejected because it would mix approval state, projection, and user interaction concerns into the same change. This slice only needs the first correct pause/resume behavior.

## Architecture for This Slice

### `src/app/main.ts`

`createApplication()` should gain a second execution path in addition to the current auto-approved happy path.

#### On inbound admin message

The app should:

1. create or reuse the thread
2. ask the runtime for a plan
3. iterate actions in order
4. for auto-approved actions, keep existing behavior
5. for the first `approval_required` action:
   - create a pending approval
   - append an `approval.requested` event
   - send a reply such as `Approval required: shell.exec (approvalId=...)`
   - stop execution without marking the thread done

#### On approval decision

The app should expose a dedicated method such as `handleApprovalDecision({ approvalId, decision })` or `resumeApproval(approvalId)`.

For this slice, only approval is needed. Rejection can remain unimplemented.

The method should:

1. fetch the pending approval
2. fail clearly if the ID is unknown or already resolved
3. execute the stored action through `tools.run(...)`
4. append `tool.completed`
5. mark the thread done
6. emit the final reply

### `src/tasks/service.ts`

The task service should remain in-memory, but it must now support approval records in addition to threads and events.

Minimal new capabilities:

- `createApprovalRequest(threadId, action, reply)`
- `getPendingApproval(approvalId)`
- `markApproved(approvalId)`
- optional `listPendingApprovals()` for smoke visibility/tests

An approval record should minimally contain:

- `id`
- `threadId`
- `action`
- `reply`
- `status: "pending" | "approved"`

### `src/tasks/state-machine.ts`

The thread state should expand beyond `queued` / `done` to include `waiting_approval`.

That allows tests and future UI work to tell the difference between:

- a thread that has not started
- a thread that is paused for approval
- a thread that is complete

### `src/cli.ts`

The CLI should continue to be the smoke runner. For this slice it should support a deterministic two-step demonstration:

1. simulate the inbound message that creates the approval request
2. simulate approving the printed `approvalId`

This can be done in one command invocation. The important part is that the console output makes the pause/resume transition obvious.

## Execution Flow

The minimal approval smoke flow should be:

1. load configuration
2. build task service with approval storage
3. build fake provider that returns one approval-required action (for example `shell.exec`)
4. build runtime, approval engine, tool registry, app, and gateway
5. inject one admin message
6. app creates thread
7. runtime returns `reply + [{ tool: "shell.exec", ... }]`
8. approval engine classifies it as `approval_required`
9. app creates approval request, appends `approval.requested`, sets thread status to `waiting_approval`, sends approval-needed reply
10. CLI prints the approval ID
11. CLI simulates `approve <approvalId>`
12. app resumes the stored action
13. tool executes and appends `tool.completed`
14. thread becomes `done`
15. final reply is emitted

## Error Handling

Keep it simple and explicit.

### Must Handle

- unknown approval ID -> clear error and no execution
- already approved approval ID -> clear error and no double execution
- tool failure after approval -> append failure event and emit failure reply
- non-admin message -> ignore as before

### Do Not Add Yet

- retry logic
- edit-before-approve
- rejection UX
- persistence recovery

## Testing Strategy

Add focused tests for:

1. app pause path
   - approval-required action creates approval request
   - thread moves to `waiting_approval`
   - final tool is not executed yet
   - approval-needed reply includes `approvalId`

2. approval resume path
   - approving a pending request executes the stored tool
   - app records `tool.completed`
   - thread becomes `done`
   - final reply emitted

3. task service approval lifecycle
   - request creation
   - lookup by ID
   - mark approved

4. CLI smoke path
   - command prints both pause and resume outputs clearly

## Verification Commands

At minimum this slice should pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm start:mvp`

The smoke output should visibly show:

- approval requested
- approval ID
- approval resumed
- final completion

## Success Criteria

This slice is complete when:

- the smoke command can demonstrate an `approval_required` action from start to finish
- pending approvals are stored in memory and addressable by ID
- the app pauses before risky tool execution
- the same action resumes only after explicit approval
- thread state visibly reaches `waiting_approval` before `done`
- tests and typecheck remain green

## Follow-Up After This Slice

Once approval pause/resume is correct in memory, the next clean slices are:

1. persist approvals and thread states in SQLite
2. surface pending approvals in the TUI
3. support rejection/edit paths
4. add real HTTP provider integration

## Decision

The repository will implement approval pause/resume as the next smoke slice using an in-memory approval store, a paused `waiting_approval` thread state, and a CLI-simulated `approve <approvalId>` flow before introducing persistence or richer operator UX.
