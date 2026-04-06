# SQLite Persistence Smoke Slice Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-05 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist the current approval-resume smoke flow to SQLite while keeping the existing CLI behavior and `TaskService` façade intact.

**Architecture:** Extend the current SQLite schema and repositories so thread status, task events, and approval requests are stored durably. Keep `TaskService` as the app-facing API, but allow it to delegate to repositories when the entrypoint wires DB-backed mode. Preserve the current fake-provider smoke loop and avoid restart recovery or TUI scope in this slice.

**Tech Stack:** Node.js, TypeScript, Vitest, better-sqlite3, current repository layer under `src/store/`, current smoke runner under `src/app/` and `src/cli.ts`.

---

### Task 1: Extend the SQLite schema and thread repository for durable smoke state

**Files:**
- Modify: `src/store/migrations.ts`
- Modify: `src/store/repositories/threads.ts`
- Test: `tests/store/threads.test.ts`
- Check: `src/store/db.ts`

**Step 1: Write the failing test**

Extend `tests/store/threads.test.ts` to require persisted thread status and event round-trip:

```ts
it("persists thread status and events", () => {
  const db = createInMemoryDatabase();
  const repo = new ThreadRepository(db);

  const thread = repo.create({ sourceUserId: "wxid_admin", title: "Run smoke flow" });
  repo.updateStatus(thread.id, "waiting_approval");
  repo.appendEvent(thread.id, { kind: "approval.requested", summary: "shell.exec approval required" });

  expect(repo.get(thread.id)).toEqual(
    expect.objectContaining({ id: thread.id, status: "waiting_approval" }),
  );
  expect(repo.listEvents(thread.id)).toEqual([
    expect.objectContaining({ kind: "approval.requested", summary: "shell.exec approval required" }),
  ]);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/threads.test.ts`
Expected: FAIL because the current schema has no `status` column and the current repository has no `updateStatus()` support.

**Step 3: Write minimal implementation**

Update the schema and repository only enough to pass:

- add `status TEXT NOT NULL DEFAULT 'queued'` to `threads`
- extend `ThreadRecord` to include `status`
- implement `updateStatus(threadId, status)`
- keep event persistence behavior working as-is

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/threads.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/store/threads.test.ts src/store/migrations.ts src/store/repositories/threads.ts
git commit -m "feat: persist thread status in sqlite"
```

---

### Task 2: Add SQLite approval repository

**Files:**
- Create: `src/store/repositories/approvals.ts`
- Modify: `src/store/migrations.ts`
- Test: `tests/store/approvals.test.ts`
- Check: `src/tasks/state-machine.ts`

**Step 1: Write the failing test**

Create `tests/store/approvals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInMemoryDatabase } from "../../src/store/db.js";
import { ApprovalRepository } from "../../src/store/repositories/approvals.js";

describe("ApprovalRepository", () => {
  it("creates, reads, and approves an approval request", () => {
    const db = createInMemoryDatabase();
    const repo = new ApprovalRepository(db);

    const created = repo.create({
      threadId: "t1",
      action: { tool: "shell.exec", input: { command: "pwd" } },
      reply: "Needs approval.",
    });

    expect(repo.get(created.id)).toEqual(
      expect.objectContaining({ id: created.id, threadId: "t1", status: "pending" }),
    );

    repo.markApproved(created.id);

    expect(repo.get(created.id)?.status).toBe("approved");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/approvals.test.ts`
Expected: FAIL because `ApprovalRepository` and `approval_requests` do not exist yet.

**Step 3: Write minimal implementation**

Implement only what the test requires:

- add `approval_requests` table with columns:
  - `id`
  - `thread_id`
  - `tool`
  - `payload`
  - `reply`
  - `status`
- create `ApprovalRepository`
- support `create`, `get`, and `markApproved`
- serialize `input` as JSON in `payload`

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/approvals.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/store/approvals.test.ts src/store/migrations.ts src/store/repositories/approvals.ts
git commit -m "feat: persist approvals in sqlite"
```

---

### Task 3: Teach TaskService to use repositories while keeping the same API

**Files:**
- Modify: `src/tasks/service.ts`
- Modify: `tests/tasks/service.test.ts`
- Check: `src/tasks/state-machine.ts`
- Check: `src/store/repositories/threads.ts`
- Check: `src/store/repositories/approvals.ts`

**Step 1: Write the failing test**

Add a DB-backed service test in `tests/tasks/service.test.ts`:

```ts
it("persists thread and approval state when repositories are provided", () => {
  const db = createInMemoryDatabase();
  const threadRepository = new ThreadRepository(db);
  const approvalRepository = new ApprovalRepository(db);
  const service = createTaskService({ threadRepository, approvalRepository });

  const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "run pwd" });
  service.appendEvent(received.threadId, { kind: "approval.requested", summary: "shell.exec approval required" });
  const approval = service.createApprovalRequest(
    received.threadId,
    { tool: "shell.exec", input: { command: "pwd" } },
    "Needs approval.",
  );
  service.markWaitingApproval(received.threadId);

  expect(threadRepository.get(received.threadId)?.status).toBe("waiting_approval");
  expect(threadRepository.listEvents(received.threadId)).toHaveLength(1);
  expect(approvalRepository.get(approval.approvalId)?.status).toBe("pending");

  service.markApproved(approval.approvalId);
  service.markDone(received.threadId);

  expect(approvalRepository.get(approval.approvalId)?.status).toBe("approved");
  expect(threadRepository.get(received.threadId)?.status).toBe("done");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: FAIL because `createTaskService()` does not currently accept repositories or persist through them.

**Step 3: Write minimal implementation**

Update `createTaskService()` so it accepts optional repositories:

```ts
createTaskService({ threadRepository?, approvalRepository? } = {})
```

Behavior:
- without repositories: preserve current in-memory mode
- with repositories:
  - `receiveMessage()` creates/finds thread through repository-backed path
  - `appendEvent()` persists to SQLite-backed events
  - `createApprovalRequest()` persists approval in `ApprovalRepository`
  - `markWaitingApproval()` and `markDone()` update thread status through `ThreadRepository`
  - `getPendingApproval()` and `markApproved()` use `ApprovalRepository`

Do not change the public app-facing method names.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts
git commit -m "feat: add repo-backed task service mode"
```

---

### Task 4: Wire the smoke entrypoint to SQLite-backed repositories

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `src/app/entrypoint.ts`
- Modify: `src/app/bootstrap.ts`
- Check: `src/store/db.ts`
- Check: `src/cli.ts`

**Step 1: Write the failing test**

Extend `tests/app/entrypoint.test.ts`:

```ts
it("builds a smoke entrypoint backed by sqlite repositories", () => {
  const entry = createDefaultEntrypoint({
    env: {
      ADMIN_USER_ID: "wxid_admin",
      WORKSPACE_ROOT: "/workspace",
      LLM_BASE_URL: "http://localhost:11434/v1",
      LLM_MODEL: "qwen2.5-coder",
      LLM_API_KEY: "",
      LLM_SUPPORTS_IMAGE_INPUT: "false",
      DATABASE_PATH: ":memory:",
    },
  });

  expect(entry.taskService).toBeDefined();
  expect(entry.app).toBeDefined();
  expect(entry.gateway).toBeDefined();
});
```

Then add one assertion path that depends on the SQLite-backed composition still exposing a working task service for the smoke flow.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: FAIL because the current entrypoint still wires the purely in-memory task service.

**Step 3: Write minimal implementation**

Update `src/app/entrypoint.ts` to:

- create the SQLite DB (`:memory:` is acceptable for smoke mode)
- instantiate `ThreadRepository` and `ApprovalRepository`
- create `TaskService` with those repositories
- preserve the current fake provider and tool stubs
- keep the existing approval-resume smoke flow behavior

If `src/app/bootstrap.ts` needs a small adjustment to keep this composition visible, update only what is required by the test.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/app/entrypoint.ts src/app/bootstrap.ts
git commit -m "feat: wire sqlite-backed smoke entrypoint"
```

---

### Task 5: Verify the approval-resume smoke flow still works and document the SQLite-backed slice

**Files:**
- Modify: `README.md`
- Check: `src/cli.ts`
- Check: `package.json`
- Check: `src/app/bootstrap.ts`

**Step 1: Update README minimally**

Update the current smoke description so it remains true after SQLite is introduced. Mention that the smoke flow now persists its thread/event/approval state through SQLite-backed repositories while still using the fake provider.

**Step 2: Run focused verification**

Run:

```bash
npx vitest run tests/store/threads.test.ts tests/store/approvals.test.ts tests/tasks/service.test.ts tests/app/entrypoint.test.ts
```

Expected: PASS.

**Step 3: Run full verification**

Run:

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

Expected:
- tests PASS
- typecheck PASS
- smoke command still shows approval created -> approved -> resumed -> final thread status `done`

**Step 4: Commit**

```bash
git add README.md tests/store/threads.test.ts tests/store/approvals.test.ts tests/tasks/service.test.ts tests/app/entrypoint.test.ts src/store/db.ts src/store/migrations.ts src/store/repositories/threads.ts src/store/repositories/approvals.ts src/tasks/service.ts src/app/entrypoint.ts src/app/bootstrap.ts
git commit -m "docs: describe sqlite-backed smoke state"
```

If the final commit needs to be split because implementation files remain unstaged from earlier tasks, split it cleanly and keep README in the docs-focused commit.

---

### Task 6: Final boundary checklist

**Files:**
- Check only

**Step 1: Re-read the slice boundaries**

Confirm the implementation did **not** add:
- restart recovery
- DB-driven TUI projections
- real HTTP provider calls
- more tool types
- approval rejection/edit UX

**Step 2: Verify persistence goals line-by-line**

Checklist:

- [x] thread status persists through SQLite
- [x] task events persist through SQLite
- [x] approval requests persist through SQLite
- [x] approval approval-state persists through SQLite
- [x] `TaskService` still hides repository details from callers
- [x] `start:mvp` still works end-to-end

**Step 3: Only make minimal follow-up fix if the checklist fails**

If everything passes, stop here and present branch-finishing options.
