# Approval Resume Smoke Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the runnable smoke MVP so an `approval_required` action pauses execution, creates an in-memory approval request, and then resumes to completion after a simulated approval.

**Architecture:** Keep the current smoke runner and fake provider setup, but add a minimal in-memory approval lifecycle to `src/tasks` and a pause/resume orchestration path in `src/app/main.ts`. Use the CLI smoke command to simulate both the initial admin message and the later `approve <approvalId>` action, without adding SQLite persistence or TUI work yet.

**Tech Stack:** Node.js, TypeScript, Vitest, existing `zod` config loader, current fake-provider smoke runner, current approval classifier, in-memory task service.

---

### Task 1: Rewrite app tests to specify approval pause and resume behavior

**Files:**
- Modify: `tests/app/main.test.ts`
- Check: `src/app/main.ts`
- Check: `src/tasks/service.ts`
- Check: `src/approval/engine.ts`

**Step 1: Write the failing tests**

Replace the current single happy-path-only contract with focused approval tests in addition to preserving the auto-approved path.

Add at least these two tests:

```ts
it("pauses when an action requires approval and returns an approval id", async () => {
  const sendReply = vi.fn();
  const createApprovalRequest = vi.fn().mockReturnValue({ approvalId: "ap1" });
  const appendEvent = vi.fn();
  const markWaitingApproval = vi.fn();
  const toolsRun = vi.fn();

  const app = createApplication({
    adminUserId: "wxid_admin",
    runtime: {
      async planNext() {
        return {
          reply: "This needs approval.",
          actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
        };
      },
    },
    approvals: {
      classifyAction() {
        return { decision: "approval_required" as const };
      },
    },
    tools: { run: toolsRun },
    taskService: {
      receiveMessage() {
        return { threadId: "t1" };
      },
      appendEvent,
      createApprovalRequest,
      markWaitingApproval,
      markDone: vi.fn(),
    },
    sendReply,
  });

  await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "run pwd", contextToken: "ctx" });

  expect(createApprovalRequest).toHaveBeenCalledWith(
    "t1",
    expect.objectContaining({ tool: "shell.exec" }),
    "This needs approval.",
  );
  expect(markWaitingApproval).toHaveBeenCalledWith("t1");
  expect(toolsRun).not.toHaveBeenCalled();
  expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("ap1"));
});

it("resumes an approved action and completes the thread", async () => {
  const sendReply = vi.fn();
  const appendEvent = vi.fn();
  const markDone = vi.fn();
  const toolsRun = vi.fn().mockResolvedValue({ ok: true, tool: "shell.exec", output: { exitCode: 0, stdout: "/workspace", stderr: "" } });

  const app = createApplication({
    adminUserId: "wxid_admin",
    runtime: { async planNext() { return { reply: "unused", actions: [] }; } },
    approvals: { classifyAction() { return { decision: "approval_required" as const }; } },
    tools: { run: toolsRun },
    taskService: {
      receiveMessage() {
        return { threadId: "t1" };
      },
      appendEvent,
      createApprovalRequest: vi.fn(),
      markWaitingApproval: vi.fn(),
      getPendingApproval() {
        return {
          id: "ap1",
          threadId: "t1",
          action: { tool: "shell.exec", input: { command: "pwd" } },
          reply: "Approved result coming.",
          status: "pending",
        };
      },
      markApproved: vi.fn(),
      markDone,
    },
    sendReply,
  });

  await app.resumeApproval("ap1");

  expect(toolsRun).toHaveBeenCalledWith({ tool: "shell.exec", input: { command: "pwd" } });
  expect(appendEvent).toHaveBeenCalledWith("t1", expect.objectContaining({ kind: "tool.completed" }));
  expect(markDone).toHaveBeenCalledWith("t1");
  expect(sendReply).toHaveBeenCalledWith("wxid_admin", "Approved result coming.");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/main.test.ts`
Expected: FAIL because the current app only handles auto-approved actions and has no approval request or resume path.

**Step 3: Write minimal implementation**

Do not add CLI logic or persistence yet. Only make the app orchestration contract capable of:
- pausing on `approval_required`
- creating an approval request
- resuming via `resumeApproval(approvalId)`

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/main.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts src/app/main.ts
git commit -m "feat: pause approval-required actions"
```

---

### Task 2: Extend task service with minimal approval lifecycle support

**Files:**
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/tasks/service.ts`
- Modify: `src/tasks/state-machine.ts`
- Check: `src/tasks/thread-router.ts`

**Step 1: Write the failing test**

Add a focused approval lifecycle test:

```ts
it("creates, reads, and approves a pending approval", () => {
  const service = createTaskService();
  const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "run pwd" });

  const pending = service.createApprovalRequest(
    received.threadId,
    { tool: "shell.exec", input: { command: "pwd" } },
    "Needs approval.",
  );

  service.markWaitingApproval(received.threadId);

  expect(service.getThread(received.threadId)?.status).toBe("waiting_approval");
  expect(service.getPendingApproval(pending.approvalId)).toEqual(
    expect.objectContaining({ id: pending.approvalId, threadId: received.threadId, status: "pending" }),
  );

  service.markApproved(pending.approvalId);

  expect(service.getPendingApproval(pending.approvalId)?.status).toBe("approved");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: FAIL because the current task service has no approval storage or `waiting_approval` state.

**Step 3: Write minimal implementation**

Implement only the in-memory pieces required by the test and app contract:
- `TaskStatus` includes `waiting_approval`
- approval record type
- `createApprovalRequest(threadId, action, reply)`
- `getPendingApproval(approvalId)`
- `markApproved(approvalId)`
- `markWaitingApproval(threadId)`

Keep thread and approval storage in memory.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts src/tasks/state-machine.ts
git commit -m "feat: track in-memory approvals"
```

---

### Task 3: Extend the smoke entrypoint to exercise approval-required flow

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `src/app/entrypoint.ts`
- Check: `src/tools/registry.ts`
- Check: `src/approval/engine.ts`

**Step 1: Write the failing test**

Add a composition test that proves the entrypoint exposes the pieces needed for an approval smoke flow:

```ts
it("builds an app and gateway that can support approval-required smoke flows", () => {
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

  expect(entry.app).toBeDefined();
  expect(entry.gateway).toBeDefined();
  expect(entry.taskService).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: FAIL because the current entrypoint returns only `{ app, gateway }` and its fake provider returns only auto-approved/empty behavior.

**Step 3: Write minimal implementation**

Update the entrypoint so it:
- builds one approval-capable smoke composition
- returns `taskService` as part of the entry for testing/smoke introspection
- uses a deterministic fake provider that can emit a `shell.exec` action for the approval flow
- still avoids any real HTTP calls

Do not overbuild provider configurability here.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/app/entrypoint.ts
git commit -m "feat: compose approval-capable smoke entrypoint"
```

---

### Task 4: Update CLI smoke runner to demonstrate pause then approve

**Files:**
- Modify: `tests/app/bootstrap.test.ts`
- Modify: `src/app/bootstrap.ts`
- Modify: `src/cli.ts`
- Modify: `package.json`
- Check: `tsconfig.build.json`

**Step 1: Write the failing test**

Extend the bootstrap/runner contract enough to support approval resume smoke behavior. Keep the test minimal, for example by asserting the bootstrap result still exists and is now approval-flow ready.

Add a focused expectation that the startup path remains valid after introducing the pause/resume flow.

**Step 2: Run test to verify it fails if needed**

Run: `npx vitest run tests/app/bootstrap.test.ts`
Expected: FAIL only if the current bootstrap surface is insufficient for the updated CLI flow. If the test already covers the required contract, keep it and move directly to implementation.

**Step 3: Write minimal implementation**

Update `src/cli.ts` so `npm run start:mvp` now demonstrates:
1. inbound admin message enters
2. approval request emitted with `approvalId`
3. CLI simulates `approve <approvalId>`
4. resumed action executes
5. final reply printed

The smoke output should visibly include both the pause and the resume stages.

**Step 4: Run test and command to verify it passes**

Run:
- `npx vitest run tests/app/bootstrap.test.ts`
- `npm run start:mvp`

Expected:
- test passes
- smoke output includes approval request and final completion

**Step 5: Commit**

```bash
git add src/app/bootstrap.ts src/cli.ts package.json tests/app/bootstrap.test.ts
git commit -m "feat: add approval resume smoke flow"
```

---

### Task 5: Update README and verify the full approval-resume slice

**Files:**
- Modify: `README.md`
- Verify: `tests/app/main.test.ts`
- Verify: `tests/tasks/service.test.ts`
- Verify: `tests/app/entrypoint.test.ts`
- Verify: `tests/app/bootstrap.test.ts`
- Modify: touched source files from Tasks 1-4 only if verification exposes minimal defects

**Step 1: Update documentation**

Add a short note to the smoke command section that the current smoke path now demonstrates:
- approval request creation
- printed approval ID
- simulated approval resume
- final completion

A minimal addition can look like:

```md
This smoke command now demonstrates both:
- an approval-required pause
- a simulated `approve <approvalId>` resume path
```

**Step 2: Run focused verification**

Run:
- `npx vitest run tests/app/main.test.ts tests/tasks/service.test.ts tests/app/entrypoint.test.ts tests/app/bootstrap.test.ts`

Expected: PASS.

**Step 3: Run full verification**

Run:
- `npx vitest run tests`
- `npx tsc --noEmit`
- `npm run start:mvp`

Expected:
- all tests pass
- typecheck passes
- smoke command prints approval request then final completion

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document approval resume smoke flow"
```

---

### Task 6: Final checklist for slice boundaries

**Files:**
- Check only; no new files required unless a minimal fix is needed

**Step 1: Re-read boundary files**

Check:
- `src/app/main.ts`
- `src/tasks/service.ts`
- `src/cli.ts`
- `README.md`

Confirm the slice did not accidentally add:
- SQLite persistence
- rejection/edit flows
- TUI approval queue logic
- real HTTP provider calls

**Step 2: Run final proof commands**

Run:
- `npx vitest run tests`
- `npx tsc --noEmit`
- `npm run start:mvp`

Expected:
- green across all commands
- smoke output clearly shows approval request, approval ID, simulated approval, and final reply

**Step 3: Commit only if verification exposes a minimal fix**

If no fix is needed, stop here and present the branch-finishing options.
