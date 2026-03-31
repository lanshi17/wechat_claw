# Thread Attach Slice Design

## Summary

This slice closes the remaining gap between the current runnable MVP and the original thread model in the 2026-03-24 design. It makes inbound admin messages attach to the most recent unfinished thread instead of only reusing threads that are still `queued`, while keeping the rest of the approval, provider, and TUI behavior unchanged.

## Scope

This slice includes exactly three outcomes:

1. Define the MVP meaning of an "unfinished" thread for inbound message routing.
2. Update thread routing and task-service behavior so a new admin message can attach to the latest unfinished thread.
3. Cover that routing contract with focused tests at the thread-router, task-service, and composition boundary where needed.

## Non-Goals

This slice does not include:

- deeper TUI approval interaction
- new approval policy categories or approval UX
- provider, runtime, or planner redesign
- WeChat gateway boundary changes
- persistence schema redesign
- richer thread summaries or artifact rendering
- multi-user thread routing

## Current State

Most of the MVP loop is already landed:

- real provider-backed runnable smoke flow exists
- SQLite-backed thread and approval persistence exists
- the full MVP tool registry surface exists
- TUI projection for thread/event/approval state exists
- trusted-admin filtering and approval pause/resume semantics exist

The remaining mismatch is in thread continuation semantics:

- `src/tasks/thread-router.ts` currently reuses only the most recent thread whose status is `queued`
- `src/tasks/state-machine.ts` models `queued`, `waiting_approval`, and `done`
- `src/tasks/service.ts` delegates inbound routing to `routeThread(...)`, so the current app cannot naturally keep using an already-active thread once it has moved from `queued` into `waiting_approval`
- the 2026-03-24 MVP design explicitly says each inbound admin message should either create a new thread or attach to the most recent unfinished thread

## Architecture

### Unfinished Thread Definition

For the current MVP, an unfinished thread should mean any thread that is not terminal.

With the current state model, that means:

- `queued` => unfinished
- `waiting_approval` => unfinished
- `done` => finished

This slice should avoid introducing new lifecycle states just to support routing. The goal is to align routing with the current model, not to expand the model.

### Routing Behavior

Thread routing should stay small and deterministic:

- look at the latest threads for the same `fromUserId`
- return the most recent unfinished thread if one exists
- otherwise create a new thread

This keeps `routeThread(...)` as a pure helper and keeps orchestration logic out of the gateway and runtime layers.

### Task-Service Behavior

`createTaskService(...)` should continue to own the creation/reuse decision through `receiveMessage(...)`, but after this slice the reuse rule changes from "latest queued thread" to "latest unfinished thread".

The service should not attempt to merge text, rewrite titles, or change approval state during attachment. It only chooses the target thread ID.

## Data Flow

1. A trusted inbound admin message reaches the app loop.
2. `taskService.receiveMessage(...)` asks `routeThread(...)` whether there is a latest unfinished thread for that sender.
3. If such a thread exists, the message attaches to that thread ID.
4. If not, the service creates a new thread as it does today.
5. All later planning, approval, and TUI projection continue unchanged.

## Testing Strategy

This slice should be implemented with strict TDD.

### Router tests

`tests/tasks/thread-router.test.ts` (or the existing nearest test location if router tests are kept inside service coverage) should prove:

- queued threads are reusable
- waiting-approval threads are also reusable
- done threads are not reusable
- the most recent unfinished thread wins when multiple unfinished threads exist

### Task-service tests

`tests/tasks/service.test.ts` should prove:

- a second message from the same admin reuses a waiting-approval thread
- a second message does not reuse a done thread
- existing persistence behavior remains intact

### Composition tests

Only if needed, `tests/app/entrypoint.test.ts` can pin that the composed service behavior still works when backed by SQLite repositories. This should stay minimal and should not broaden into new smoke behavior.

## Risks and Mitigations

### Risk: Slice accidentally becomes full conversation memory

Mitigation: keep the change limited to routing and reuse. Do not add message history summarization, title rewriting, or agent-context changes.

### Risk: Persistence and in-memory routing diverge

Mitigation: keep focused tests for both plain in-memory task-service behavior and DB-backed repository composition.

### Risk: "unfinished" becomes ambiguous later

Mitigation: encode the current MVP rule directly in tests so future lifecycle expansion can deliberately revisit the definition.

## Success Criteria

This slice is complete when:

- inbound routing reuses the latest unfinished thread, not only queued threads
- waiting-approval threads are treated as attachable
- done threads are treated as terminal
- focused routing/service tests prove the new behavior
- root tests and typecheck remain green without touching unrelated subsystems

## Follow-On Work

After this slice lands, the next likely candidates are:

1. deeper TUI approval interaction
2. richer failed/rejected lifecycle states
3. broader end-to-end thread history presentation
