# WeChat Agent TUI MVP Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-05 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current layered skeleton into a runnable local MVP that accepts an admin WeChat message, plans reply/tool actions, auto-runs safe tools, pauses risky tools for approval, and exposes a smoke-testable startup path.

**Architecture:** Preserve the existing module boundaries in `src/app`, `src/agent`, `src/tasks`, `src/tools`, `src/approval`, `src/store`, `src/tui`, and `src/wechat`. Implement the missing runtime glue by adding a thin composition entrypoint, extending the task/app loop to persist thread events and approvals, and wiring a stub-friendly startup path plus package scripts.

**Tech Stack:** Node.js 20+, TypeScript, pnpm, Vitest, `better-sqlite3`, `zod`.

---

### Task 1: Add failing tests for runnable MVP composition

**Files:**
- Modify: `tests/app/main.test.ts`
- Create: `tests/app/entrypoint.test.ts`
- Modify: `src/app/main.ts`
- Create: `src/app/entrypoint.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createApplication } from "../../src/app/main.js";

describe("createApplication", () => {
  it("runs an auto-approved tool action and sends a final reply", async () => {
    const sendReply = vi.fn();
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
        appendEvent: vi.fn(),
        markWaitingApproval: vi.fn(),
        markDone: vi.fn(),
      },
      sendReply,
    });

    await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "search rustls", contextToken: "ctx" });

    expect(sendReply).toHaveBeenCalledWith("wxid_admin", expect.stringContaining("Searching"));
  });
});
```

```typescript
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

Run: `pnpm vitest run tests/app/main.test.ts tests/app/entrypoint.test.ts`
Expected: FAIL because `createApplication` does not yet support the runtime loop and `src/app/entrypoint.ts` does not exist.

**Step 3: Write minimal implementation**

Implement:
- `src/app/main.ts` as the orchestrator for admin-message handling
- `src/app/entrypoint.ts` as a thin composition layer that loads config, database, repositories, runtime, approvals, tools, app, TUI view-model support, and gateway

The first passing version should:
- reject non-admin messages
- create or reuse a thread
- ask the runtime for a plan
- run auto-approved tools
- send a text reply
- expose `{ app, gateway }`

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/main.test.ts tests/app/entrypoint.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts tests/app/entrypoint.test.ts src/app/main.ts src/app/entrypoint.ts
git commit -m "feat: wire runnable app entrypoint"
```

### Task 2: Extend task service for evented thread lifecycle

**Files:**
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/tasks/service.ts`
- Modify: `src/tasks/state-machine.ts`
- Modify: `src/tasks/thread-router.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { createTaskService } from "../../src/tasks/service.js";

describe("TaskService", () => {
  it("records lifecycle and approval state for a thread", () => {
    const service = createTaskService();

    const received = service.receiveMessage({ fromUserId: "wxid_admin", text: "run pwd" });
    service.appendEvent(received.threadId, { kind: "plan.created", summary: "plan created" });
    service.markWaitingApproval(received.threadId, { tool: "shell.exec", summary: "waiting for shell approval" });

    expect(service.getThread(received.threadId)?.status).toBe("waiting_approval");
    expect(service.listEvents(received.threadId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "approval.requested" })]),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/tasks/service.test.ts`
Expected: FAIL because the current service only returns thread IDs and does not expose event or state transitions.

**Step 3: Write minimal implementation**

Implement in-memory lifecycle support:
- persist `title`, `status`, and per-thread event timeline
- add `appendEvent(threadId, event)`
- add `listEvents(threadId)`
- add `markWaitingApproval(threadId, approval)`
- add `markDone(threadId)` and `markFailed(threadId, reason)`

Keep the service small and deterministic so it remains easy to swap onto SQLite-backed repositories later.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/tasks/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts src/tasks/state-machine.ts src/tasks/thread-router.ts
git commit -m "feat: track thread lifecycle and events"
```

### Task 3: Expand tool registry beyond shell-only execution

**Files:**
- Modify: `tests/tools/registry.test.ts`
- Modify: `src/tools/registry.ts`
- Modify: `src/tools/web/runner.ts`
- Modify: `src/tools/fs/runner.ts`
- Modify: `src/tools/vision/runner.ts`
- Modify: `src/tools/wechat/runner.ts`
- Modify: `src/tools/shell/runner.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createToolRegistry } from "../../src/tools/registry.js";

describe("ToolRegistry", () => {
  it("dispatches web, file, vision, reply, and shell tools to normalized runners", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
      webSearch: vi.fn().mockResolvedValue({ items: [{ title: "rustls" }] }),
      webFetch: vi.fn().mockResolvedValue({ url: "https://example.com", text: "hello" }),
      fsRead: vi.fn().mockResolvedValue({ path: "/workspace/README.md", content: "hi" }),
      fsWrite: vi.fn().mockResolvedValue({ path: "/workspace/out.txt", bytesWritten: 2 }),
      visionAnalyze: vi.fn().mockResolvedValue({ summary: "diagram" }),
      wechatReply: vi.fn().mockResolvedValue({ delivered: true }),
    });

    const webResult = await registry.run({ tool: "web.search", input: { query: "rustls" } });
    const fsResult = await registry.run({ tool: "fs.read", input: { path: "README.md" } });

    expect(webResult.ok).toBe(true);
    expect(fsResult.ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/tools/registry.test.ts`
Expected: FAIL because the registry currently only supports `shell.exec`.

**Step 3: Write minimal implementation**

Implement a normalized registry contract:
- accept dependencies for `shell.exec`, `fs.read`, `fs.write`, `web.search`, `web.fetch`, `vision.analyze`, and `wechat.reply`
- return `{ ok, output }` consistently
- throw a clear error for unsupported tools
- keep runner modules as thin wrappers so application logic stays in `src/app/main.ts`

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/tools/registry.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tools/registry.test.ts src/tools/registry.ts src/tools/shell/runner.ts src/tools/fs/runner.ts src/tools/web/runner.ts src/tools/vision/runner.ts src/tools/wechat/runner.ts
git commit -m "feat: support the full MVP tool surface"
```

### Task 4: Add approval-request handling for risky actions

**Files:**
- Modify: `tests/app/main.test.ts`
- Modify: `tests/approval/engine.test.ts`
- Modify: `src/app/main.ts`
- Modify: `src/approval/engine.ts`
- Modify: `src/approval/policies.ts`

**Step 1: Write the failing test**

```typescript
it("pauses risky actions for approval instead of executing them", async () => {
  const sendReply = vi.fn();
  const runTool = vi.fn();
  const taskService = {
    receiveMessage() {
      return { threadId: "t1" };
    },
    appendEvent: vi.fn(),
    markWaitingApproval: vi.fn(),
    markDone: vi.fn(),
  };

  const app = createApplication({
    adminUserId: "wxid_admin",
    runtime: {
      async planNext() {
        return { reply: "Need approval", actions: [{ tool: "shell.exec", input: { command: "pwd" } }] };
      },
    },
    approvals: { classifyAction: () => ({ decision: "approval_required" as const }) },
    tools: { run: runTool },
    taskService,
    sendReply,
  });

  await app.handleAdminMessage({ fromUserId: "wxid_admin", text: "pwd", contextToken: "ctx" });

  expect(runTool).not.toHaveBeenCalled();
  expect(taskService.markWaitingApproval).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/main.test.ts tests/approval/engine.test.ts`
Expected: FAIL because the app loop does not yet branch on approval-required actions.

**Step 3: Write minimal implementation**

Implement approval behavior in the app loop:
- call `classifyAction` for every planned tool action
- execute only `auto_approve`
- emit approval-request events and set thread status to `waiting_approval` for `shell.exec` and `fs.write`
- send an operator-facing acknowledgement reply when a request is paused

Keep the approval engine policy exactly aligned with the design doc.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/main.test.ts tests/approval/engine.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/main.test.ts tests/approval/engine.test.ts src/app/main.ts src/approval/engine.ts src/approval/policies.ts
git commit -m "feat: pause risky tool actions for approval"
```

### Task 5: Add admin filtering and provider/runtime smoke behavior

**Files:**
- Modify: `tests/wechat/gateway.test.ts`
- Modify: `tests/agent/runtime.test.ts`
- Modify: `src/wechat/gateway.ts`
- Modify: `src/wechat/types.ts`
- Modify: `src/agent/runtime.ts`
- Modify: `src/agent/planner.ts`
- Modify: `src/agent/provider/base.ts`
- Modify: `src/agent/provider/openai.ts`
- Modify: `src/agent/provider/ollama.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createWeChatGateway } from "../../src/wechat/gateway.js";

describe("WeChatGateway", () => {
  it("ignores inbound messages from non-admin users", async () => {
    const onMessage = vi.fn();
    const gateway = createWeChatGateway({ adminUserId: "wxid_admin", onMessage });

    await gateway.handleInbound({ fromUserId: "wxid_guest", text: "run tests", contextToken: "ctx" });

    expect(onMessage).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/wechat/gateway.test.ts tests/agent/runtime.test.ts`
Expected: FAIL because the current gateway forwards all messages and runtime/provider contracts are still minimal.

**Step 3: Write minimal implementation**

Implement:
- admin-aware gateway filtering
- small but explicit provider contract types for `reply` + `actions`
- a deterministic stub provider helper for local smoke startup
- runtime pass-through that remains testable and capability-aware

Do not add real network calls in this task.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/wechat/gateway.test.ts tests/agent/runtime.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/wechat/gateway.test.ts tests/agent/runtime.test.ts src/wechat/gateway.ts src/wechat/types.ts src/agent/runtime.ts src/agent/planner.ts src/agent/provider/base.ts src/agent/provider/openai.ts src/agent/provider/ollama.ts
git commit -m "feat: enforce admin boundary and runtime contracts"
```

### Task 6: Add TUI projection for approvals and thread history

**Files:**
- Modify: `tests/tui/app.test.ts`
- Modify: `src/tui/app.ts`
- Modify: `src/tui/screens/main-screen.ts`
- Modify: `src/tui/widgets/thread-list.ts`
- Modify: `src/tui/widgets/approval-queue.ts`
- Modify: `src/tui/widgets/event-log.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildMainViewModel } from "../../src/tui/app.js";

describe("buildMainViewModel", () => {
  it("projects latest event summaries and approval queue state", () => {
    const model = buildMainViewModel({
      threads: [{ id: "t1", title: "Fix tests", status: "waiting_approval", latestEventSummary: "approval requested" }],
      approvals: [{ id: "a1", threadId: "t1", tool: "shell.exec", summary: "pwd" }],
    });

    expect(model.threadItems[0]?.label).toContain("approval requested");
    expect(model.pendingApprovalCount).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/tui/app.test.ts`
Expected: FAIL because the current view model only projects title and status.

**Step 3: Write minimal implementation**

Extend the TUI projection layer to include:
- latest event summary per thread
- pending approval list shape with thread/tool labels
- enough state for a basic main-screen rendering and smoke observation

Keep the UI model-oriented. Do not build a full interactive terminal in this task.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/tui/app.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts src/tui/app.ts src/tui/screens/main-screen.ts src/tui/widgets/thread-list.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts
git commit -m "feat: project thread and approval state into the tui"
```

### Task 7: Add runnable package scripts and CLI startup

**Files:**
- Modify: `package.json`
- Create: `src/cli.ts`
- Modify: `src/app/bootstrap.ts`
- Modify: `tests/app/entrypoint.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { bootstrapApplication } from "../../src/app/bootstrap.js";

describe("bootstrapApplication", () => {
  it("returns a startable runtime with gateway and app", () => {
    const runtime = bootstrapApplication({
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

    expect(runtime.start).toBeTypeOf("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/entrypoint.test.ts`
Expected: FAIL because there is no bootstrap/startable runtime yet.

**Step 3: Write minimal implementation**

Implement:
- `bootstrapApplication` to create the composed runtime
- `src/cli.ts` to call `bootstrapApplication(process.env).start()`
- package scripts such as:
  - `test`
  - `typecheck`
  - `dev` or `start` for the CLI entrypoint

The first runnable version may use local stub dependencies for smoke testing as long as the startup path is real.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/entrypoint.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json src/cli.ts src/app/bootstrap.ts tests/app/entrypoint.test.ts
git commit -m "feat: add runnable cli bootstrap"
```

### Task 8: Verify the complete MVP flow

**Files:**
- Modify: `tests/app/main.test.ts`
- Modify: `tests/app/entrypoint.test.ts`
- Modify: any touched source files from Tasks 1-7 only if verification exposes minimal defects

**Step 1: Write the failing test**

Add one high-level integration-style test that proves:
- admin inbound message enters the app loop
- runtime emits one auto-approved tool action
- tool result is recorded
- final reply is sent
- risky tool plans pause for approval instead of executing

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/main.test.ts tests/app/entrypoint.test.ts`
Expected: FAIL until all wiring is complete.

**Step 3: Write minimal implementation**

Only fix defects exposed by the integration test. Do not broaden scope.

**Step 4: Run test to verify it passes**

Run:
- `pnpm vitest run`
- `pnpm tsc --noEmit`

Expected: PASS.

**Step 5: Smoke verification**

Run the new startup command with local env values and verify:
- the process starts successfully
- a stubbed inbound admin message can be handled
- auto-approved actions execute
- risky actions move into `waiting_approval`

If the app requires a manual harness, document the exact command and expected console output in the PR or handoff notes.

**Step 6: Commit**

```bash
git add tests/app/main.test.ts tests/app/entrypoint.test.ts src/app/main.ts src/app/entrypoint.ts src/app/bootstrap.ts src/cli.ts package.json
git commit -m "feat: complete runnable wechat agent mvp loop"
```

## Verification Checklist

Before claiming completion:

- Run: `pnpm vitest run`
- Run: `pnpm tsc --noEmit`
- Run: the new startup command from `package.json`
- Verify non-admin messages are ignored
- Verify `web.search`, `web.fetch`, `fs.read`, `vision.analyze`, and `wechat.reply` can be auto-approved by policy
- Verify `shell.exec` and `fs.write` are paused for approval and not executed immediately
- Verify the TUI view model can project thread and approval state from current data

## Notes for Execution

- Follow `@test-driven-development` strictly: no production code before a failing test.
- Keep changes incremental and localized; do not rewrite existing module boundaries.
- Use stub or fake implementations for smoke testing instead of introducing external API coupling.
- Do not commit unless the user explicitly asks for a commit.
