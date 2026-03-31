# Thread Attach Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make inbound admin messages attach to the most recent unfinished thread instead of only reusing queued threads.

**Architecture:** Keep the slice narrow. Update the routing rule in `src/tasks/thread-router.ts`, verify the behavior through `src/tasks/service.ts`, and touch composed entrypoint coverage only if verification exposes a persistence mismatch. Do not broaden into UI, approval-policy, or provider/runtime changes.

**Tech Stack:** TypeScript, Vitest, task-service and SQLite-backed repository composition.

---

### Task 1: Define unfinished-thread routing in the pure router

**Files:**
- Create: `tests/tasks/thread-router.test.ts`
- Modify: `src/tasks/thread-router.ts`

**Step 1: Write the failing test**

Create `tests/tasks/thread-router.test.ts` with focused cases that prove:

- the latest `queued` thread is reused
- the latest `waiting_approval` thread is reused
- `done` threads are not reused
- if both `done` and unfinished threads exist, the most recent unfinished thread wins

Example shape:

```typescript
import { describe, expect, it } from "vitest";
import { routeThread } from "../../src/tasks/thread-router.js";

describe("routeThread", () => {
  it("reuses the most recent unfinished thread", () => {
    const selected = routeThread(
      [
        { id: "t1", fromUserId: "wxid_admin", status: "done" },
        { id: "t2", fromUserId: "wxid_admin", status: "waiting_approval" },
      ],
      "wxid_admin",
    );

    expect(selected?.id).toBe("t2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tasks/thread-router.test.ts`

Expected: FAIL because the current router only reuses `queued` threads.

**Step 3: Write minimal implementation**

Update `src/tasks/thread-router.ts` so the router returns the most recent thread for the same user whose status is not terminal. With the current state model, `done` is terminal and `queued` / `waiting_approval` are unfinished.

Do not add new statuses or timestamps in this task.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tasks/thread-router.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/thread-router.test.ts src/tasks/thread-router.ts
git commit -m "feat: route inbound messages to unfinished threads"
```

### Task 2: Apply the new routing rule through TaskService

**Files:**
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/tasks/service.ts`

**Step 1: Write the failing test**

Extend `tests/tasks/service.test.ts` with cases that prove:

- a second message from the same admin reuses a `waiting_approval` thread
- a second message after `markDone(...)` creates a new thread instead of reusing the finished one

Keep the tests small and use the public `receiveMessage(...)`, `markWaitingApproval(...)`, and `markDone(...)` API.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tasks/service.test.ts`

Expected: FAIL because service reuse still follows the old queued-only rule.

**Step 3: Write minimal implementation**

Update `src/tasks/service.ts` only as needed so `receiveMessage(...)` cleanly follows the new router contract. Prefer using the new router behavior over duplicating status logic inside the service.

Do not add title rewriting, message history aggregation, or new persistence APIs.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tasks/service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts
git commit -m "feat: reuse unfinished threads in task service"
```

### Task 3: Verify repository-backed composition stays aligned

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `src/app/entrypoint.ts` only if verification exposes a minimal composition defect

**Step 1: Write the failing test only if needed**

Check whether current coverage already proves repository-backed thread reuse semantics. If not, add one narrow composition test in `tests/app/entrypoint.test.ts` that:

- creates a thread
- marks it `waiting_approval`
- sends another message from the same user through the composed service path
- confirms the same thread ID is reused

**Step 2: Run test to verify it fails (if added)**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: FAIL only if composed persistence currently diverges from in-memory routing behavior.

**Step 3: Write minimal implementation only if needed**

If the new composition test fails, make the smallest fix in already touched composition files so repository-backed behavior matches the routing contract.

Do not broaden into smoke flow, provider wiring, or gateway changes.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/app/entrypoint.ts
git commit -m "test: align composed thread attachment behavior"
```

### Task 4: Verify the slice stays green

**Files:**
- Modify: touched files from Tasks 1-3 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/tasks/thread-router.test.ts tests/tasks/service.test.ts tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npx vitest run --exclude ".worktrees/**" tests`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Fix only verification-exposed defects**

If anything fails, make the smallest change necessary in files already touched by this slice. Do not broaden into TUI, approval policy, provider, or gateway work.

**Step 4: Re-run verification to confirm green**

Run the same commands again and confirm zero failures.

**Step 5: Commit**

```bash
git add tests/tasks/thread-router.test.ts tests/tasks/service.test.ts tests/app/entrypoint.test.ts src/tasks/thread-router.ts src/tasks/service.ts src/app/entrypoint.ts
git commit -m "test: verify unfinished thread attachment slice"
```
