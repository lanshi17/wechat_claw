# Runnable MVP Smoke Slice Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-05 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current `master` branch into a smoke-runnable MVP slice that can simulate one trusted admin message, produce one auto-approved tool action, execute it, and emit a final reply.

**Architecture:** Keep the current layered boundaries in `src/app`, `src/agent`, `src/tasks`, `src/tools`, and `src/wechat`, but close the happy-path runtime loop first. Use a deterministic fake provider and a stubbed `web.search` runner to make the repository runnable before adding approval pause/resume, TUI interaction, or a real HTTP provider.

**Tech Stack:** Node.js, TypeScript, Vitest, existing `zod` config loader, existing runtime/planner/provider abstractions.

---

### Task 1: Rewrite app test to specify the runnable happy path

**Files:**
- Modify: `tests/app/main.test.ts`
- Check: `src/app/main.ts`
- Check: `src/tasks/service.ts`
- Check: `src/tools/registry.ts`

**Step 1: Write the failing test**

Replace the current loose assertion with a concrete orchestration contract:

```ts
import { describe, expect, it, vi } from "vitest";
import { createApplication } from "../../src/app/main.js";

describe("createApplication", () => {
  it("runs one auto-approved tool action and sends a final reply", async () => {
    const sendReply = vi.fn();
    const appendEvent = vi.fn();
    const markDone = vi.fn();

    const app = createApplication({
      adminUserId: "wxid_admin",
      runtime: {
        async planNext() {
          return {
            reply: "Searching the web first.",
            actions: [{ tool: "web.search", input: { query: "rustls" } }],
          };
        },
      },
      approvals: {
        classifyAction(action: { tool: string }) {
          return { decision: action.tool === "web.search" ? "auto_approve" : "approval_required" as const };
        },
      },
      tools: {
        async run(action: { tool: string; input: unknown }) {
          return { ok: true, output: { items: [{ title: "rustls" }], action } };
        },
      },
      taskService: {
        receiveMessage() {
          return { threadId: "t1" };
        },
        appendEvent,
        markDone,
      },
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "search rustls", contextToken: "ctx" });

    expect(appendEvent).toHaveBeenCalledWith("t1", expect.objectContaining({ kind: "tool.completed" }));
    expect(markDone).toHaveBeenCalledWith("t1");
    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("Searching"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/main.test.ts`
Expected: FAIL because `src/app/main.ts` is still the echo stub and does not orchestrate runtime, approvals, tools, or task events.

**Step 3: Write minimal implementation**

Do not implement beyond the smallest happy path needed for this test. Let later tasks add composition and startup.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/main.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts src/app/main.ts
git commit -m "feat: run the smoke-loop happy path"
```

---

### Task 2: Extend task service with minimal event lifecycle support

**Files:**
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/tasks/service.ts`
- Modify: `src/tasks/state-machine.ts`
- Check: `src/tasks/thread-router.ts`

**Step 1: Write the failing test**

Add a focused lifecycle test:

```ts
import { describe, expect, it } from "vitest";
import { createTaskService } from "../../src/tasks/service.js";

describe("TaskService", () => {
  it("records thread events and a done status", () => {
    const service = createTaskService();

    const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "search rustls" });
    service.appendEvent(received.threadId, { kind: "tool.completed", summary: "web search done" });
    service.markDone(received.threadId);

    expect(service.getThread(received.threadId)?.status).toBe("done");
    expect(service.listEvents(received.threadId)).toEqual([
      expect.objectContaining({ kind: "tool.completed", summary: "web search done" }),
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: FAIL because the current service only creates threads and does not store events or done-state transitions.

**Step 3: Write minimal implementation**

Implement only:
- `appendEvent(threadId, event)`
- `listEvents(threadId)`
- `markDone(threadId)`
- status support for `done`

Keep the implementation in memory for this slice.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tasks/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts src/tasks/state-machine.ts
git commit -m "feat: track smoke-run thread events"
```

---

### Task 3: Expand the registry to support a stubbed web search path

**Files:**
- Modify: `tests/tools/registry.test.ts`
- Modify: `src/tools/registry.ts`
- Modify: `src/tools/web/runner.ts`
- Check: `src/tools/shell/runner.ts`

**Step 1: Write the failing test**

Define the smallest supported smoke tool path:

```ts
import { describe, expect, it, vi } from "vitest";
import { createToolRegistry } from "../../src/tools/registry.js";

describe("ToolRegistry", () => {
  it("runs web.search through a normalized runner", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn(),
      webSearch: vi.fn().mockResolvedValue({ items: [{ title: "rustls" }] }),
    });

    const result = await registry.run({ tool: "web.search", input: { query: "rustls" } });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ items: [{ title: "rustls" }] });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tools/registry.test.ts`
Expected: FAIL because the registry currently supports only `shell.exec`.

**Step 3: Write minimal implementation**

Implement only enough registry support for:
- `web.search`
- existing `shell.exec` behavior preserved
- normalized `{ ok, output }` result shape

Do not add the full tool matrix yet.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tools/registry.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tools/registry.test.ts src/tools/registry.ts src/tools/web/runner.ts
git commit -m "feat: add stubbed web search execution"
```

---

### Task 4: Add a real composition entrypoint and startup runner

**Files:**
- Create: `src/app/entrypoint.ts`
- Create: `src/cli.ts`
- Modify: `src/app/bootstrap.ts`
- Modify: `package.json`
- Create: `tests/app/entrypoint.test.ts`

**Step 1: Write the failing test**

Create an entrypoint test that locks the startup surface:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultEntrypoint } from "../../src/app/entrypoint.js";

describe("createDefaultEntrypoint", () => {
  it("builds a runnable app and gateway from env", () => {
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: FAIL because there is no composed entrypoint or startup surface yet.

**Step 3: Write minimal implementation**

Create a thin composition layer that:
- loads config
- builds a deterministic fake provider
- builds runtime
- builds task service
- builds approval engine
- builds registry with stubbed `web.search`
- builds app and gateway
- exposes a simple CLI-compatible startup function

Update `package.json` with a runnable command such as `start:mvp`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/entrypoint.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/entrypoint.ts src/cli.ts src/app/bootstrap.ts package.json tests/app/entrypoint.test.ts
git commit -m "feat: add runnable smoke entrypoint"
```

---

### Task 5: Verify the full smoke slice and document the command

**Files:**
- Modify: `README.md`
- Verify: `tests/app/main.test.ts`
- Verify: `tests/tasks/service.test.ts`
- Verify: `tests/tools/registry.test.ts`
- Verify: `tests/app/entrypoint.test.ts`
- Modify: touched source files from Tasks 1-4 only if verification exposes minimal defects

**Step 1: Write the failing doc expectation**

Update `README.md` current-state/commands wording so the repo no longer claims only test/typecheck are available once the runnable smoke command exists.

A minimal expected addition:

```md
### 4) Run the smoke MVP path / 运行最小闭环

```bash
pnpm start:mvp
```
```

**Step 2: Run verification to confirm docs are outdated**

Run: `grep -n "start:mvp\|smoke" README.md package.json`
Expected: current README does not yet document the smoke command.

**Step 3: Write minimal implementation**

Update the README so it documents:
- the new smoke command
- that this path is a deterministic local MVP runner, not the full approval/TUI workflow yet

Do not overstate completeness.

**Step 4: Run full verification**

Run:
- `npx vitest run tests/app/main.test.ts tests/tasks/service.test.ts tests/tools/registry.test.ts tests/app/entrypoint.test.ts`
- `npx vitest run`
- `npx tsc --noEmit`
- `pnpm start:mvp`

Expected:
- focused tests PASS
- full suite PASS or clearly identify unrelated pre-existing failures
- typecheck PASS
- smoke command runs and prints a final reply path

**Step 5: Commit**

```bash
git add README.md package.json src/app/main.ts src/tasks/service.ts src/tasks/state-machine.ts src/tools/registry.ts src/tools/web/runner.ts src/app/entrypoint.ts src/cli.ts src/app/bootstrap.ts tests/app/main.test.ts tests/tasks/service.test.ts tests/tools/registry.test.ts tests/app/entrypoint.test.ts
git commit -m "docs: add runnable smoke mvp command"
```

---

### Task 6: Final checklist for the slice

**Files:**
- Verify only

**Step 1: Confirm design-slice boundaries stayed intact**

Check that this slice does **not** add:
- approval resume logic
- real HTTP provider calls
- real TUI rendering loop
- real WeChat transport integration

**Step 2: Confirm success criteria**

Verify that:
- repo has a runnable command
- one simulated trusted admin message closes the happy path
- one auto-approved tool executes through the registry
- a final reply is emitted

**Step 3: Commit only if a minimal follow-up fix was required**

If verification uncovered no extra defects, no extra commit is needed here.
