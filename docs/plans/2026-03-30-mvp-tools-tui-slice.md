# MVP Tool Registry + TUI Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the MVP tool registry to the full planned tool surface and add a richer but still minimal TUI projection for thread events and approvals.

**Architecture:** Normalize runner input/output contracts in `src/tools/*/runner.ts`, use `src/tools/registry.ts` as the single dispatch boundary, and extend the TUI through view-model/state types only. This slice intentionally avoids admin-boundary work and approval-flow rewrites.

**Tech Stack:** TypeScript, Vitest, Node.js module boundaries, lightweight TUI view models.

---

### Task 1: Normalize the missing tool runner contracts

**Files:**
- Modify: `tests/tools/registry.test.ts`
- Modify: `src/tools/fs/runner.ts`
- Modify: `src/tools/web/runner.ts`
- Modify: `src/tools/vision/runner.ts`
- Modify: `src/tools/wechat/runner.ts`
- Modify: `src/tools/shell/runner.ts`

**Step 1: Write the failing test**

Add or replace the registry test with cases that exercise the missing tool names and require complete input/output shapes for:

- `fs.read`
- `fs.write`
- `web.fetch`
- `vision.analyze`
- `wechat.reply`

Example assertions to include:

```typescript
it("dispatches fs.read and returns a normalized result", async () => {
  const registry = createToolRegistry({
    shellExec: vi.fn(),
    fsRead: vi.fn().mockResolvedValue({ path: "/workspace/README.md", content: "hello" }),
  });

  const result = await registry.run({ tool: "fs.read", input: { path: "README.md" } });

  expect(result.tool).toBe("fs.read");
  expect(result.ok).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/registry.test.ts`

Expected: FAIL because the current registry and runner types do not yet support the full tool surface.

**Step 3: Write minimal implementation**

Complete the missing runner type contracts:

- `src/tools/fs/runner.ts`
  - add `FsReadOutput`, `FsRead`
  - add `FsWriteInput`, `FsWriteOutput`, `FsWrite`
- `src/tools/web/runner.ts`
  - keep `WebSearch*`
  - add `WebFetchInput`, `WebFetchOutput`, `WebFetch`
- `src/tools/vision/runner.ts`
  - add `VisionAnalyzeOutput`, `VisionAnalyze`
- `src/tools/wechat/runner.ts`
  - add `WechatReplyOutput`, `WechatReply`
- keep `src/tools/shell/runner.ts` aligned with the same style, but do not broaden beyond needed contract consistency

Keep these files type-only and minimal.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/registry.test.ts`

Expected: still FAIL or partially pass until Task 2 wires the registry. That is acceptable at this step as long as failures now point at missing registry dispatch rather than missing types.

**Step 5: Commit**

```bash
git add tests/tools/registry.test.ts src/tools/fs/runner.ts src/tools/web/runner.ts src/tools/vision/runner.ts src/tools/wechat/runner.ts src/tools/shell/runner.ts
git commit -m "feat: normalize mvp tool runner contracts"
```

### Task 2: Expand the registry to the full MVP tool surface

**Files:**
- Modify: `tests/tools/registry.test.ts`
- Modify: `src/tools/registry.ts`

**Step 1: Write the failing test**

Extend `tests/tools/registry.test.ts` so one test or a small test group proves:

- `shell.exec`
- `fs.read`
- `fs.write`
- `web.search`
- `web.fetch`
- `vision.analyze`
- `wechat.reply`

all dispatch to the correct injected dependency, and unsupported names still throw.

Example unsupported-path assertion:

```typescript
await expect(registry.run({ tool: "unknown.tool", input: {} })).rejects.toThrow(
  "Unsupported tool: unknown.tool",
);
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/registry.test.ts`

Expected: FAIL because `src/tools/registry.ts` currently supports only `shell.exec` and `web.search`.

**Step 3: Write minimal implementation**

In `src/tools/registry.ts`:

- import the new runner types
- extend `createToolRegistry(...)` dependency options to include:
  - `fsRead`
  - `fsWrite`
  - `webFetch`
  - `visionAnalyze`
  - `wechatReply`
- extend `ToolResult` to include discriminated result variants for all supported tools
- dispatch each supported tool by exact name
- preserve clear configuration errors when an optional dependency is missing
- preserve `Unsupported tool: <name>` for unknown tool names

Keep the registry small and branch-based; do not add a more abstract plugin framework.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/registry.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tools/registry.test.ts src/tools/registry.ts
git commit -m "feat: support the full mvp tool registry"
```

### Task 3: Add richer TUI view-model projection

**Files:**
- Modify: `tests/tui/app.test.ts`
- Modify: `src/tui/app.ts`
- Modify: `src/tui/screens/main-screen.ts`
- Modify: `src/tui/widgets/thread-list.ts`
- Modify: `src/tui/widgets/approval-queue.ts`
- Modify: `src/tui/widgets/event-log.ts`

**Step 1: Write the failing test**

Replace or extend `tests/tui/app.test.ts` to prove that `buildMainViewModel(...)` can project:

- a latest event summary into the thread label or thread display data
- a richer approval queue item with a readable summary
- a simple event-log list for the selected thread

Example shape:

```typescript
const model = buildMainViewModel({
  threads: [
    {
      id: "t1",
      title: "Fix tests",
      status: "waiting_approval",
      latestEventSummary: "approval requested",
    },
  ],
  approvals: [{ id: "a1", threadId: "t1", tool: "shell.exec", summary: "pwd" }],
  events: [{ id: "e1", summary: "approval requested" }],
});

expect(model.threadItems[0]?.label).toContain("approval requested");
expect(model.approvalItems[0]?.summary).toBe("pwd");
expect(model.eventItems[0]?.summary).toBe("approval requested");
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: FAIL because the current projection only includes thread labels and approval count.

**Step 3: Write minimal implementation**

Update the view-model layer only:

- `src/tui/widgets/thread-list.ts`
  - extend `ThreadItem` only as needed
- `src/tui/widgets/approval-queue.ts`
  - add a `summary` field
- `src/tui/widgets/event-log.ts`
  - keep `EventLogItem` simple and reuse it in the main state
- `src/tui/screens/main-screen.ts`
  - include `approvalItems` and `eventItems` in `MainScreenState`
- `src/tui/app.ts`
  - accept the richer input shape
  - project latest-event summary into thread labels or equivalent display shape
  - project `approvalItems`
  - project `eventItems`
  - preserve `pendingApprovalCount`

Do not add terminal interaction logic.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts src/tui/app.ts src/tui/screens/main-screen.ts src/tui/widgets/thread-list.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts
git commit -m "feat: enrich the mvp tui projection"
```

### Task 4: Verify the slice stays green in the wider repo

**Files:**
- Modify: touched files from Tasks 1-3 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/tools/registry.test.ts tests/tui/app.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npx vitest run --exclude ".worktrees/**" tests`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Fix only verification-exposed defects**

If anything fails, make the smallest change necessary in files already touched by this slice. Do not pull in admin-boundary or app-loop scope.

**Step 4: Re-run verification to confirm green**

Run the same three commands again and confirm zero failures.

**Step 5: Commit**

```bash
git add tests/tools/registry.test.ts tests/tui/app.test.ts src/tools/registry.ts src/tools/fs/runner.ts src/tools/web/runner.ts src/tools/vision/runner.ts src/tools/wechat/runner.ts src/tools/shell/runner.ts src/tui/app.ts src/tui/screens/main-screen.ts src/tui/widgets/thread-list.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts
git commit -m "feat: complete the mvp tool and tui slice"
```

## Verification Checklist

Before claiming completion:

- Run: `npx vitest run tests/tools/registry.test.ts tests/tui/app.test.ts`
- Run: `npx vitest run --exclude ".worktrees/**" tests`
- Run: `npx tsc --noEmit`
- Verify registry supports `shell.exec`, `fs.read`, `fs.write`, `web.search`, `web.fetch`, `vision.analyze`, and `wechat.reply`
- Verify unsupported tools still throw a clear error
- Verify TUI projection exposes latest event summary, approval item details, and event items
- Verify no admin-boundary behavior was added in this slice

## Notes for Execution

- Follow `@test-driven-development` strictly: no production code before a failing test.
- Keep runner files type-oriented and thin.
- Keep TUI work model-oriented; do not build a full interactive screen loop here.
- Do not commit unless the user explicitly asks for a commit.
