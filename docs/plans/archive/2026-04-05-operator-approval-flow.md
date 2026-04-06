# Operator Approval Flow Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-06 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit operator reject handling, replace the hardcoded smoke CLI with reusable commands, project approval decisions into the TUI model, and verify both approve and reject flows through SQLite-backed integration coverage.

**Architecture:** Keep the existing `TaskService -> Application -> CLI/TUI` boundaries. Extend approval persistence and task-service APIs first, then wire reject orchestration in `src/app/main.ts`, then add command-driven CLI and richer TUI projection, and finally prove both decision paths in repository-backed composition tests.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, Node.js CLI entrypoints, existing SQLite-backed repositories and view-model-only TUI.

---

### Task 1: Persist rejected approval decisions

**Files:**
- Modify: `tests/store/approvals.test.ts`
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/store/repositories/approvals.ts`
- Modify: `src/tasks/service.ts`

**Step 1: Write the failing tests**

Extend store and task-service coverage with small tests that prove:

- `ApprovalRepository.markRejected(...)` persists `status = "rejected"`
- `TaskService.markRejected(...)` updates the in-memory approval record
- `TaskService.markRejected(...)` also works when wired to `ApprovalRepository`

Use the existing approval creation helpers and keep each test focused on one state transition.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store/approvals.test.ts tests/tasks/service.test.ts`

Expected: FAIL because the repository and task service do not yet expose a rejected path.

**Step 3: Write minimal implementation**

Implement only the missing rejected-path APIs:

- add `markRejected(approvalId)` to `ApprovalRepository`
- add `markRejected(approvalId)` to `TaskService`
- keep the current approval record shape; do not add a new schema column for reason text

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store/approvals.test.ts tests/tasks/service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/store/approvals.test.ts tests/tasks/service.test.ts src/store/repositories/approvals.ts src/tasks/service.ts
git commit -m "feat: persist rejected approval decisions"
```

### Task 2: Add explicit rejection handling in the app loop

**Files:**
- Modify: `tests/app/main.test.ts`
- Modify: `src/app/main.ts`

**Step 1: Write the failing tests**

Extend `tests/app/main.test.ts` with focused reject-path coverage that proves:

- `rejectApproval(approvalId, reason)` exists
- rejecting an approval does not call `tools.run(...)`
- rejecting appends `approval.rejected`
- rejecting marks the thread failed
- rejecting sends a final reply containing the rejection outcome or reason

Keep approve-path and auto-approved coverage intact.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/main.test.ts`

Expected: FAIL because `createApplication(...)` does not yet expose or implement a reject path.

**Step 3: Write minimal implementation**

In `src/app/main.ts`:

- add `rejectApproval(approvalId, reason?)`
- load the stored approval through `getPendingApproval(...)`
- call `markRejected(...)`
- append an `approval.rejected` event
- mark the thread failed with a readable summary
- send a final operator-facing reply

Do not run the stored tool action in this path.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/main.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts src/app/main.ts
git commit -m "feat: add explicit approval rejection handling"
```

### Task 3: Replace the hardcoded smoke CLI with reusable commands

**Files:**
- Create: `tests/cli.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/app/bootstrap.ts` only if a thin reusable seam is required for testing or command wiring

**Step 1: Write the failing tests**

Create `tests/cli.test.ts` with cases that prove:

- `message <text...>` submits an admin message through the composed path
- `approve <approvalId>` approves and resumes the stored action
- `reject <approvalId> [reason...]` rejects the stored action and reports a failed thread
- invalid or missing subcommands produce a usage error and non-zero exit behavior if you model exit status indirectly

Prefer testing small extracted command helpers if direct `process.argv` handling would make the file brittle.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cli.test.ts`

Expected: FAIL because `src/cli.ts` is still a fixed smoke script.

**Step 3: Write minimal implementation**

Refactor `src/cli.ts` into a command parser and thin command handlers:

- `message <text...>`
- `approve <approvalId>`
- `reject <approvalId> [reason...]`

Reuse `bootstrapApplication(...)`. Do not add a new operator runtime abstraction.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cli.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/cli.test.ts src/cli.ts src/app/bootstrap.ts
git commit -m "feat: add reusable operator cli commands"
```

### Task 4: Project approval decisions and failures into the TUI view model

**Files:**
- Modify: `tests/tui/app.test.ts`
- Modify: `src/tui/app.ts`
- Modify: `src/tui/screens/main-screen.ts`
- Modify: `src/tui/widgets/approval-queue.ts`
- Modify: `src/tui/widgets/event-log.ts`
- Modify: `src/tui/widgets/thread-list.ts` only if a minimal type adjustment is needed

**Step 1: Write the failing tests**

Extend `tests/tui/app.test.ts` to prove:

- approval items include status
- rejected approval items can carry a readable summary
- failed threads surface latest rejection or failure text
- event items include `approval.rejected` and `thread.failed`

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: FAIL because the current projection does not include approval status or rejection-specific thread context.

**Step 3: Write minimal implementation**

Update the view-model layer only:

- extend `ApprovalQueueItem` with `status`
- project richer approval items in `buildMainViewModel(...)`
- preserve `pendingApprovalCount` semantics
- keep the TUI layer renderer-free and state-only

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts src/tui/app.ts src/tui/screens/main-screen.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts src/tui/widgets/thread-list.ts
git commit -m "feat: project approval decisions into tui state"
```

### Task 5: Verify approve and reject flows through SQLite-backed composition

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `src/app/entrypoint.ts`
- Modify: `src/app/bootstrap.ts` only if command-driven composition exposes a minimal defect

**Step 1: Write the failing tests**

Extend `tests/app/entrypoint.test.ts` with focused repository-backed coverage that proves:

- a persisted approval can be approved and resumed after recreating the entrypoint
- a persisted approval can be rejected after recreating the entrypoint
- the reject path leaves the thread failed and the approval rejected

Keep the tests limited to operator decision lifecycle behavior.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: FAIL because composed entrypoint wiring does not yet expose the full reject path.

**Step 3: Write minimal implementation**

Adjust composition only as needed:

- expose `markRejected(...)` through the composed task-service boundary
- ensure `createApplication(...)` receives the APIs needed for both approve and reject
- keep provider and gateway behavior unchanged

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/app/entrypoint.ts src/app/bootstrap.ts
git commit -m "test: verify operator approval decisions in composition"
```

### Task 6: Run full verification and update Ralph progress

**Files:**
- Modify: `ralph/prd.json`
- Modify: `ralph/progress.txt`
- Modify: touched files from Tasks 1-5 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/store/approvals.test.ts tests/tasks/service.test.ts tests/app/main.test.ts tests/cli.test.ts tests/tui/app.test.ts tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npm test`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Update Ralph tracking**

Mark each completed story as `passes: true` in `ralph/prd.json` and check it off in `ralph/progress.txt`. Add short notes only if verification uncovered something worth recording.

**Step 4: Re-run verification to confirm final green state**

Run the same commands again if any verification fix was needed.

**Step 5: Commit**

```bash
git add ralph/prd.json ralph/progress.txt tests/store/approvals.test.ts tests/tasks/service.test.ts tests/app/main.test.ts tests/cli.test.ts tests/tui/app.test.ts tests/app/entrypoint.test.ts src/store/repositories/approvals.ts src/tasks/service.ts src/app/main.ts src/cli.ts src/tui/app.ts src/tui/screens/main-screen.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts src/tui/widgets/thread-list.ts src/app/entrypoint.ts src/app/bootstrap.ts
git commit -m "feat: complete operator approval flow"
```
