# SQLite Persistence Smoke Slice Design

## Summary

Add the smallest SQLite-backed persistence layer on top of the current approval-resume smoke MVP. The goal of this slice is to keep the current runnable CLI smoke flow intact while persisting thread status, task events, and approval requests into SQLite through repositories, without introducing restart recovery, TUI projections, or a large service-layer rewrite.

## Why This Slice

The repository now has a runnable smoke path via `start:mvp`, including an approval pause/resume loop. However, all task, event, and approval state still lives only in memory inside `src/tasks/service.ts`.

That means the current flow proves the orchestration behavior, but not durable state management:

1. message enters the app
2. runtime produces an action
3. approval request is created
4. action resumes and completes
5. all state disappears with process exit

The next highest-value gap is therefore to persist the existing smoke state model into SQLite while preserving the current app and CLI behavior.

## Product Goal for This Slice

A local developer should be able to run the same smoke flow and know that:

1. thread status is stored in SQLite
2. task events are stored in SQLite
3. approval requests and approval status are stored in SQLite
4. the app still talks to `TaskService`, not directly to repositories
5. the current CLI smoke path still demonstrates pause -> approve -> resume -> done

## Scope

### In Scope

- extend the SQLite schema for thread status
- persist task events in SQLite through a repository-backed path
- add a minimal approval repository for pending/approved records
- let `TaskService` delegate to repositories when they are provided
- keep the current CLI smoke flow working against SQLite-backed storage
- add repository and service tests for the DB-backed path

### Out of Scope

- restart recovery that automatically resumes unfinished threads
- rebuilding runtime state from the DB on process boot
- TUI approval queue or thread/event projections backed by SQLite
- replacing the fake provider
- adding more tool types
- approval rejection/edit flows
- removing the in-memory fallback entirely

## Recommended Approach

### Chosen Approach

Persist the current in-memory smoke state model into SQLite while keeping `TaskService` as the façade used by the app and entrypoint.

That means `src/app/main.ts`, `src/app/entrypoint.ts`, and `src/cli.ts` should continue to call the same task-service methods:

- `receiveMessage`
- `appendEvent`
- `listEvents`
- `createApprovalRequest`
- `markWaitingApproval`
- `getPendingApproval`
- `markApproved`
- `markDone`

But when repositories are wired in, those methods should persist their effects through SQLite instead of only mutating in-memory maps.

### Alternatives Considered

#### 1. Full repository-first rewrite

Rejected for now because it would force the app and smoke runner to know too much about repository boundaries. This slice should prove persistence, not re-architect the whole task layer.

#### 2. Event-only persistence

Rejected because the current smoke app already depends on direct thread and approval state lookups. Reconstructing everything from events would add unnecessary design complexity before durable state has been proven.

#### 3. Remove in-memory mode entirely

Rejected because tests and lightweight smoke composition still benefit from a simple fallback. Keeping optional repository injection minimizes churn and keeps the current architecture stable.

## Data Model

### Threads

Persist these thread fields:

- `id`
- `source_user_id`
- `title`
- `status` (`queued`, `waiting_approval`, `done`)

### Task Events

Persist these task-event fields:

- `id`
- `thread_id`
- `kind`
- `summary`

### Approval Requests

Persist these approval-request fields:

- `id`
- `thread_id`
- `tool`
- `payload` (JSON string)
- `reply`
- `status` (`pending`, `approved`, `rejected`)

This is intentionally the minimum shape needed to support the current smoke loop.

## Architecture for This Slice

### `src/store/migrations.ts`

Extend the schema so SQLite can represent the current smoke-loop state.

Changes should include:

- add `status` column to `threads`
- keep `task_events` for ordered event history
- add an `approval_requests` table for approval lifecycle state

Do not add extra columns for speculative future needs.

### `src/store/repositories/threads.ts`

Extend `ThreadRepository` so it can:

- create threads
- fetch threads with persisted `status`
- update thread status
- append and list task events (or continue delegating event persistence through the same repository if that remains the simplest path)

### `src/store/repositories/events.ts`

This file is currently only an `EventInput` type. It can either remain minimal or be expanded into a small event repository if that helps keep concerns clear.

The key requirement is not a specific class boundary. The key requirement is durable event persistence with a clean API.

### `src/store/repositories/approvals.ts`

Add a new repository for approval records.

Minimal capabilities:

- create approval request
- get approval by ID
- mark approval approved

The repository should store the action as:

- `tool`
- `payload` JSON string

and return it as structured data when read back.

### `src/tasks/service.ts`

Keep `TaskService` as the public façade.

Recommended shape:

- `createTaskService()` still works in pure in-memory mode
- `createTaskService({ threadRepository, approvalRepository })` enables SQLite-backed mode

In DB-backed mode, the service should:

- create threads through `ThreadRepository`
- persist status updates through `ThreadRepository`
- persist events through repository-backed storage
- persist approval requests and approval status through `ApprovalRepository`

The app should not need to know which mode is active.

### `src/app/entrypoint.ts`

Wire the smoke app to SQLite-backed repositories by default for this slice.

That means the entrypoint should:

1. create the SQLite DB
2. apply migrations
3. create repositories
4. create `TaskService` with those repositories
5. keep the existing fake provider / stub runner setup
6. keep the current approval-resume smoke behavior

### `src/cli.ts`

The CLI should remain the top-level demonstration path.

For this slice it should continue to:

1. bootstrap the app
2. trigger the approval-required smoke message
3. approve the created approval ID
4. resume execution
5. print final thread status

The difference is that the underlying state should now live in SQLite-backed repositories.

## Error Handling

Keep the same philosophy as the previous smoke slices: simple and visible.

### Must Handle

- missing thread lookup in DB-backed mode -> explicit error
- missing approval lookup in DB-backed mode -> explicit error
- malformed approval payload readback -> explicit error
- SQLite persistence/write failure -> explicit error that aborts the smoke flow

### Do Not Add Yet

- retry logic for DB writes
- migration rollback handling
- automatic recovery of unfinished work after process restart
- complex transaction orchestration beyond what is minimally necessary

## Testing Strategy

### 1. Repository Tests

Add repository tests that prove:

- `ThreadRepository` persists `status`
- event persistence round-trips correctly
- `ApprovalRepository` can create, read, and approve a record

### 2. Task Service Tests

Keep the current task-service API tests and add a DB-backed variant that proves the same methods work when repositories are injected.

### 3. Smoke Composition Tests

Verify the current approval-resume smoke flow still works when entrypoint composition uses SQLite-backed repositories.

### 4. CLI Smoke Verification

Keep `start:mvp` as the top-level demonstration command. It should still show:

- approval created
- approval approved
- resumed execution
- final thread status `done`

## Verification Commands

Preferred commands:

```bash
pnpm test
pnpm typecheck
ADMIN_USER_ID=wxid_admin \
WORKSPACE_ROOT=/workspace \
LLM_BASE_URL=http://localhost:11434/v1 \
LLM_MODEL=qwen2.5-coder \
LLM_API_KEY='' \
LLM_SUPPORTS_IMAGE_INPUT=false \
DATABASE_PATH=:memory: \
pnpm start:mvp
```

Fallback equivalents if `pnpm` is unavailable locally:

```bash
npx vitest run tests
npx tsc --noEmit
ADMIN_USER_ID=wxid_admin \
WORKSPACE_ROOT=/workspace \
LLM_BASE_URL=http://localhost:11434/v1 \
LLM_MODEL=qwen2.5-coder \
LLM_API_KEY='' \
LLM_SUPPORTS_IMAGE_INPUT=false \
DATABASE_PATH=:memory: \
npm run start:mvp
```

## Success Criteria

This slice is complete when:

1. current smoke flow still works end-to-end
2. thread status is stored in SQLite
3. events are stored in SQLite
4. approval requests and approval status are stored in SQLite
5. `TaskService` public API still shields callers from repository details
6. no restart-recovery or TUI scope creep is introduced

## Follow-Up Slices After This One

Once SQLite persistence is in place, the next likely slices become cleaner and more valuable:

- restart-aware recovery
- TUI thread and approval projection from durable state
- replacing the fake provider with real OpenAI-compatible HTTP calls
- broader tool-surface expansion
