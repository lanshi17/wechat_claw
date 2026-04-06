# Start MVP Smoke Entrypoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `npm run start:mvp` execute a real one-command approval smoke loop that boots the composed app, simulates one trusted-admin message, detects a newly created approval, resumes it automatically, and prints the final thread status.

**Architecture:** Add a dedicated `src/smoke.ts` entrypoint instead of overloading the reusable CLI. Reuse `bootstrapApplication(...)` and the existing `gateway`, `app`, and `taskService` boundaries so the smoke runner follows the same composition path as the rest of the app. Detect the approval created by the current run by diffing approval IDs before and after the inbound message, and fail loudly when the provider does not produce an approval-required action.

**Tech Stack:** TypeScript, Vitest, Node.js entrypoints, existing bootstrap/app/task-service composition, Better SQLite3.

---

### Task 1: Add failing tests for the scripted smoke runner

**Files:**
- Create: `tests/smoke.test.ts`
- Create: `src/smoke.ts`
- Check: `src/app/bootstrap.ts`

**Step 1: Write the failing tests**

Create `tests/smoke.test.ts` with two focused cases:

```typescript
import { describe, expect, it, vi } from "vitest";
import { runMvpSmoke } from "../src/smoke.js";

describe("runMvpSmoke", () => {
  it("submits a smoke message, resumes the new approval, and prints final status", async () => {
    const approvals = [];
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };
    const resumeApproval = vi.fn().mockImplementation(async () => {
      thread.status = "done";
    });
    const gatewayHandleInbound = vi.fn();
    const thread = { id: "t1", status: "waiting_approval" };

    const exitCode = await runMvpSmoke({
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout,
      stderr,
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { resumeApproval },
        gateway: {
          handleInbound: gatewayHandleInbound.mockImplementation(async () => {
            approvals.push({
              id: "ap1",
              threadId: "t1",
              status: "pending",
              action: { tool: "shell.exec", input: { command: "pwd" } },
              reply: "Need approval",
            });
          }),
        },
        taskService: {
          listApprovals: () => approvals,
          getThread: () => thread,
        },
      }),
    });

    expect(exitCode).toBe(0);
    expect(gatewayHandleInbound).toHaveBeenCalledTimes(1);
    expect(resumeApproval).toHaveBeenCalledWith("ap1");
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("Final thread status: done"));
    expect(stderr.write).not.toHaveBeenCalled();
  });

  it("fails when no new pending approval is created", async () => {
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };

    const exitCode = await runMvpSmoke({
      env: { ADMIN_USER_ID: "wxid_admin" },
      stdout,
      stderr,
      bootstrapApplication: vi.fn().mockResolvedValue({
        app: { resumeApproval: vi.fn() },
        gateway: { handleInbound: vi.fn() },
        taskService: {
          listApprovals: () => [],
          getThread: () => undefined,
        },
      }),
    });

    expect(exitCode).toBe(1);
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining("No new pending approval"));
  });
});
```

Use a local `const approvals = []` array in the happy-path test so the fake gateway can append the approval created by the smoke message.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/smoke.test.ts`

Expected: FAIL because `src/smoke.ts` and `runMvpSmoke(...)` do not exist yet.

**Step 3: Write minimal implementation**

In `src/smoke.ts`:

- export `runMvpSmoke(...)`
- accept injectable `bootstrapApplication`, `stdout`, and `stderr`
- bootstrap the runtime
- snapshot existing approval IDs
- send one fixed trusted-admin inbound message through `gateway.handleInbound(...)`
- detect the new `pending` approval by ID diff
- call `app.resumeApproval(approvalId)`
- read the final thread status with `taskService.getThread(threadId)`
- return `0` on success and `1` on contract failure

Do not change `src/cli.ts`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/smoke.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/smoke.test.ts src/smoke.ts
git commit -m "feat: add dedicated start:mvp smoke runner"
```

### Task 2: Add the command-line wrapper and preserve CLI behavior

**Files:**
- Modify: `src/smoke.ts`
- Check: `tests/cli.test.ts`
- Check: `src/cli.ts`

**Step 1: Write the failing regression test**

Add one small assertion to `tests/cli.test.ts` or a focused smoke test seam that proves:

- the reusable CLI still prints usage for missing subcommands

If current coverage already proves this exact behavior, treat the existing test as the red-phase guard and do not add a duplicate test.

**Step 2: Run test to verify the guard still holds**

Run: `npx vitest run tests/cli.test.ts tests/smoke.test.ts`

Expected: PASS for the existing CLI contract and FAIL only if the smoke wrapper leaks changes into `src/cli.ts`.

**Step 3: Write minimal implementation**

Add a tiny `main()` wrapper in `src/smoke.ts`:

- call `runMvpSmoke(...)` with process defaults
- set `process.exitCode`
- print a readable error if an unexpected exception escapes

Keep `src/cli.ts` unchanged.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli.test.ts tests/smoke.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/smoke.ts tests/cli.test.ts
git commit -m "test: preserve cli behavior while adding smoke entrypoint"
```

### Task 3: Repoint `start:mvp` and update docs to match reality

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/plans/README.md`

**Step 1: Write the failing expectation**

Use the current observed behavior as the red phase:

Run: `npm run start:mvp`

Expected today: FAIL with CLI usage output because `package.json` still points at `dist/cli.js`.

Record that this is the failing contract mismatch to fix in this task.

**Step 2: Write minimal implementation**

Update:

- `package.json` so `start:mvp` runs `node dist/smoke.js`
- `README.md` so the startup section describes the dedicated smoke entrypoint and its success/failure contract
- `docs/plans/README.md` so the active plan list points at this design and implementation plan while the work is in progress

Do not add new environment variables for this slice.

**Step 3: Run focused verification**

Run:

- `npx vitest run tests/smoke.test.ts tests/cli.test.ts`
- `npm run build`

Expected: PASS.

**Step 4: Run the runtime contract check**

Run: `npm run start:mvp`

Expected:

- if the configured environment and provider are absent, the command should fail for missing config or unreachable provider, not with CLI usage
- if the configured provider returns an approval-required action, the command should print the approval ID and final thread status

**Step 5: Commit**

```bash
git add package.json README.md docs/plans/README.md
git commit -m "docs: align start:mvp with dedicated smoke entrypoint"
```

### Task 4: Run full verification and refresh tracking

**Files:**
- Modify: `ralph/prd.json`
- Modify: `ralph/progress.txt`
- Modify: touched files from Tasks 1-3 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/smoke.test.ts tests/cli.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Expected: PASS.

**Step 3: Update Ralph tracking**

Archive the current active Ralph run if the branch is being reused, then update `ralph/prd.json` and `ralph/progress.txt` so they describe the dedicated `start:mvp` smoke entrypoint slice.

Mark stories complete only after Step 2 passes.

**Step 4: Re-run runtime verification if any fixes were needed**

Run:

- `npm run start:mvp`

Expected: no CLI usage output on the default path.

**Step 5: Commit**

```bash
git add ralph/prd.json ralph/progress.txt tests/smoke.test.ts src/smoke.ts package.json README.md docs/plans/README.md
git commit -m "feat: make start:mvp run the dedicated smoke loop"
```
