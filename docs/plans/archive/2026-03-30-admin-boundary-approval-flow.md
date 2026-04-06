# Admin Boundary + Approval Flow Slice Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-05 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce the trusted-admin gateway boundary and make approval-required action handling explicit and fully tested in the application loop.

**Architecture:** Keep the slice narrow. Filter non-admin inbound messages at `src/wechat/gateway.ts`, preserve the existing approval-policy boundary in `src/approval/*`, and tighten the application loop in `src/app/main.ts` so pause/resume behavior is clear and test-driven.

**Tech Stack:** TypeScript, Vitest, lightweight orchestration modules.

---

### Task 1: Enforce the trusted-admin gateway boundary

**Files:**
- Modify: `tests/wechat/gateway.test.ts`
- Modify: `src/wechat/gateway.ts`

**Step 1: Write the failing test**

Extend `tests/wechat/gateway.test.ts` with a second case proving that non-admin inbound messages are ignored.

Example assertion:

```typescript
it("ignores inbound messages from non-admin users", async () => {
  const onMessage = vi.fn();
  const gateway = createWeChatGateway({ adminUserId: "wxid_admin", onMessage });

  await gateway.handleInbound({ fromUserId: "wxid_guest", text: "run tests", contextToken: "ctx" });

  expect(onMessage).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wechat/gateway.test.ts`

Expected: FAIL because the current gateway forwards every inbound message.

**Step 3: Write minimal implementation**

Update `src/wechat/gateway.ts` so `createWeChatGateway(...)` accepts `adminUserId` and only forwards inbound messages when `message.fromUserId === adminUserId`.

Keep the file small; do not add logging, persistence, or transport complexity.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wechat/gateway.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/wechat/gateway.test.ts src/wechat/gateway.ts
git commit -m "feat: enforce the trusted admin gateway boundary"
```

### Task 2: Tighten approval-required action handling in the app loop

**Files:**
- Modify: `tests/app/main.test.ts`
- Modify: `src/app/main.ts`

**Step 1: Write the failing test**

Replace or extend the approval-flow test coverage in `tests/app/main.test.ts` so it proves all of the following:

- auto-approved actions still execute immediately
- approval-required actions do not call `tools.run(...)`
- approval-required actions create approval state and mark the thread waiting
- approval-required actions send an acknowledgement reply that includes the approval ID
- `resumeApproval(...)` executes the stored action and completes the thread

If one of these already passes today, tighten the assertion so the test describes the exact intended contract rather than incidental behavior.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/main.test.ts`

Expected: FAIL or expose at least one missing/underspecified approval behavior before implementation changes.

**Step 3: Write minimal implementation**

In `src/app/main.ts`:

- keep the defensive admin check in `handleAdminMessage(...)`
- keep classifying every action through `deps.approvals.classifyAction(...)`
- on `auto_approve`, execute the tool and append a `tool.completed` event
- on `approval_required`, create the approval request, mark waiting approval, send the acknowledgement reply, and return immediately
- in `resumeApproval(...)`, execute the stored action, append the completion event, mark the thread done, and send the stored reply

Do not add new policy categories, batching, retries, or extra runtime planning loops.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/main.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts src/app/main.ts
git commit -m "feat: harden the approval flow in the app loop"
```

### Task 3: Pin the MVP approval boundary if needed

**Files:**
- Modify: `tests/approval/engine.test.ts`
- Modify: `src/approval/engine.ts`
- Modify: `src/approval/policies.ts`

**Step 1: Write the failing test**

Only if current coverage is missing, add or tighten `tests/approval/engine.test.ts` so it proves:

- `shell.exec` => `approval_required`
- `fs.write` => `approval_required`
- `web.search` (or another safe tool) => `auto_approve`

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/approval/engine.test.ts`

Expected: FAIL only if the current engine/policy coverage is insufficient.

**Step 3: Write minimal implementation**

If needed, make the smallest change required to keep `src/approval/engine.ts` and `src/approval/policies.ts` aligned with the fixed MVP boundary. Prefer test-only tightening over policy changes if behavior is already correct.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/approval/engine.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/approval/engine.test.ts src/approval/engine.ts src/approval/policies.ts
git commit -m "test: pin the mvp approval policy boundary"
```

### Task 4: Verify the slice stays green

**Files:**
- Modify: touched files from Tasks 1-3 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/wechat/gateway.test.ts tests/app/main.test.ts tests/approval/engine.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npx vitest run --exclude ".worktrees/**" tests`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Fix only verification-exposed defects**

If anything fails, make the smallest change necessary in files already touched by this slice. Do not broaden scope into thread continuation, TUI, or runtime/provider redesign.

**Step 4: Re-run verification to confirm green**

Run the same commands again and confirm zero failures.

**Step 5: Commit**

```bash
git add tests/wechat/gateway.test.ts tests/app/main.test.ts tests/approval/engine.test.ts src/wechat/gateway.ts src/app/main.ts src/approval/engine.ts src/approval/policies.ts
git commit -m "test: verify admin boundary and approval flow slice"
```
