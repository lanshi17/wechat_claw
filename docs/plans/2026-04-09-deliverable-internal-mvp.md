# Deliverable Internal MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current smoke-driven WeChat Claw slice into a directly deliverable single-machine MVP for internal technical colleagues.

**Architecture:** Keep the existing composition centered on `bootstrapApplication(...)`, but separate the real long-running runtime from the smoke verifier. Add a production runtime entrypoint, harden startup/recovery diagnostics, verify restart-safe approval handling, and ship the docs/config surface needed for handoff.

**Tech Stack:** TypeScript, Vitest, Node.js entrypoints, Better SQLite3, existing bootstrap/app/task-service/TUI composition.

---

### Task 1: Add a real long-running runtime entrypoint

**Files:**
- Create: `src/main-entrypoint.ts`
- Modify: `package.json`
- Test: `tests/app/entrypoint.test.ts`
- Check: `src/app/bootstrap.ts`
- Check: `src/tui/runtime.ts`

**Step 1: Write the failing test**

Add a focused test to `tests/app/entrypoint.test.ts` that proves a new `runMainEntrypoint(...)` function:

- bootstraps the app with injected env
- calls `runtime.start()` exactly once
- starts the TUI with the bootstrapped `app` and `taskService`
- returns exit code `0` on success

Use a test shape like:

```ts
it("starts the real runtime and launches the TUI", async () => {
  const start = vi.fn().mockResolvedValue({});
  const startTuiRuntime = vi.fn();

  const exitCode = await runMainEntrypoint({
    env: { ADMIN_USER_ID: "wxid_admin" },
    stdout: { write: vi.fn() },
    stderr: { write: vi.fn() },
    bootstrapApplication: vi.fn().mockResolvedValue({
      app: { resumeApproval: vi.fn(), rejectApproval: vi.fn() },
      gateway: {},
      taskService: { listThreads: vi.fn(), listApprovals: vi.fn(), listEvents: vi.fn() },
      start,
    }),
    startTuiRuntime,
  });

  expect(exitCode).toBe(0);
  expect(start).toHaveBeenCalledTimes(1);
  expect(startTuiRuntime).toHaveBeenCalledWith(
    expect.objectContaining({ app: expect.any(Object), taskService: expect.any(Object) }),
    expect.any(Object),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: FAIL because `src/main-entrypoint.ts` and `runMainEntrypoint(...)` do not exist yet.

**Step 3: Write minimal implementation**

Create `src/main-entrypoint.ts` that:

- exports `runMainEntrypoint(...)`
- accepts injectable `bootstrapApplication`, `startTuiRuntime`, `stdout`, and `stderr`
- calls `bootstrapApplication({ env })`
- awaits `runtime.start()`
- calls `startTuiRuntime({ app: runtime.app, taskService: runtime.taskService }, { stdin, stdout })`
- returns `0` on success
- catches startup errors, prints `Runtime startup failed: <message>` to stderr, and returns `1`
- exports a tiny `main()` wrapper that sets `process.exitCode`

Do not overload `src/smoke.ts` for this path.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/main-entrypoint.ts package.json
git commit -m "feat: add real runtime entrypoint"
```

### Task 2: Classify startup failures and print actionable diagnostics

**Files:**
- Modify: `src/shared/config.ts`
- Modify: `src/app/bootstrap.ts`
- Modify: `src/main-entrypoint.ts`
- Test: `tests/shared/config.test.ts`
- Test: `tests/app/bootstrap.test.ts`

**Step 1: Write the failing tests**

Add two focused tests:

1. in `tests/shared/config.test.ts`, assert a helper can summarize missing required env names in a stable order
2. in `tests/app/bootstrap.test.ts`, assert bootstrap/startup failures are surfaced as typed categories such as `config`, `provider`, `database`, or `gateway`

Example expectation for config summary:

```ts
expect(describeConfigError({
  issues: [
    { path: ["ADMIN_USER_ID"] },
    { path: ["DATABASE_PATH"] },
  ],
} as any)).toContain("Missing required config: ADMIN_USER_ID, DATABASE_PATH");
```

Example expectation for bootstrap classification:

```ts
await expect(bootstrapApplication({ env: {} })).rejects.toMatchObject({
  category: "config",
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/shared/config.test.ts tests/app/bootstrap.test.ts`

Expected: FAIL because the config-description/classification behavior does not exist yet.

**Step 3: Write minimal implementation**

In `src/shared/config.ts`:

- add `describeConfigError(error)` that turns Zod missing-field issues into one readable line

In `src/app/bootstrap.ts`:

- wrap config loading and entrypoint creation in `try/catch`
- rethrow typed errors shaped like `{ category: "config" | "provider" | "database" | "gateway", message: string, cause?: unknown }`
- start with concrete coverage for config errors; map unknown failures conservatively to a general startup category only if they do not match a known source

In `src/main-entrypoint.ts`:

- print `Startup failed [<category>]: <message>`
- do not dump noisy stack traces by default

Keep this minimal and additive.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/shared/config.test.ts tests/app/bootstrap.test.ts tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/config.ts src/app/bootstrap.ts src/main-entrypoint.ts tests/shared/config.test.ts tests/app/bootstrap.test.ts tests/app/entrypoint.test.ts
git commit -m "feat: classify startup failures"
```

### Task 3: Verify restart-safe approval recovery through the real runtime path

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Modify: `tests/tui/runtime.test.ts`
- Check: `src/app/entrypoint.ts`
- Check: `src/tui/runtime.ts`
- Check: `src/tasks/service.ts`

**Step 1: Write the failing test**

Add one recovery-focused integration test to `tests/app/entrypoint.test.ts` that:

- creates a persistent SQLite-backed entrypoint
- writes a pending approval
- recreates the runtime through the real startup path
- proves the pending approval is still visible to the TUI-facing task service after restart

Use a temp db path, mirroring the existing persistence tests.

Also add one assertion to `tests/tui/runtime.test.ts` that proves the recovered approval remains selectable and actionable after a restart-shaped task-service snapshot.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/entrypoint.test.ts tests/tui/runtime.test.ts`

Expected: FAIL only for the new recovery expectations.

**Step 3: Write minimal implementation**

If the new tests fail, make only the smallest fixes needed in the production startup path. Likely acceptable changes:

- ensure `runMainEntrypoint(...)` starts the runtime before launching TUI
- ensure any recovery-sensitive startup work inside `bootstrapApplication(...).start()` is invoked during the real runtime path
- keep recovery logic in existing task-service/repository layers; do not duplicate recovery state in the entrypoint

If tests already pass without code changes, keep this as explicit evidence and do not refactor.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/entrypoint.test.ts tests/tui/runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts tests/tui/runtime.test.ts src/main-entrypoint.ts src/app/bootstrap.ts
if needed: git add any minimal recovery-fix files
git commit -m "test: verify runtime restart recovery"
```

### Task 4: Add deliverable config artifacts and real-runtime docs

**Files:**
- Create: `.env.example`
- Modify: `README.md`
- Modify: `docs/plans/README.md`
- Check: `src/shared/config.ts`
- Check: `package.json`

**Step 1: Write the failing expectation**

Use the current repo state as the red phase:

- there is no `.env.example`
- README does not yet define a production runtime command and handoff-grade startup flow

Record this mismatch by adding one focused docs/config assertion to an existing lightweight test file if the repo already has a docs-contract seam; otherwise use the observed missing files/state as the explicit red-phase note for this task.

**Step 2: Write minimal implementation**

Create `.env.example` with exactly the currently supported variables:

```dotenv
ADMIN_USER_ID=wxid_admin
WORKSPACE_ROOT=/absolute/path/to/workspace
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5-coder
LLM_API_KEY=
LLM_SUPPORTS_IMAGE_INPUT=false
DATABASE_PATH=./data/wechat-claw.db
```

Update `README.md` to include:

- install steps
- copy/configure `.env.example`
- smoke verification with `npm run start:mvp`
- real runtime startup with the new command from Task 1
- restart/recovery expectations
- a short troubleshooting section covering missing config, unreachable provider, gateway issues, and DB path problems

Update `docs/plans/README.md` so this new design/implementation pair is listed as the active productization target.

**Step 3: Run focused verification**

Run: `npx vitest run tests/shared/config.test.ts tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 4: Run doc/runtime verification**

Run:

- `npm run build`
- `npm run start:mvp`
- `npm run start:wechat`

Expected:

- build passes
- smoke command still runs the smoke verifier path
- real runtime command fails clearly on missing config if env is absent, instead of crashing unclearly

**Step 5: Commit**

```bash
git add .env.example README.md docs/plans/README.md package.json src/main-entrypoint.ts
if needed: git add any test files touched for command/docs verification
git commit -m "docs: add deliverable runtime setup guide"
```

### Task 5: Run full verification and refresh Ralph tracking for deliverable MVP

**Files:**
- Modify: `ralph/prd.json`
- Modify: `ralph/progress.txt`
- Modify: touched files from Tasks 1-4 only if verification exposes minimal defects

**Step 1: Run focused verification**

Run:

- `npx vitest run tests/app/entrypoint.test.ts tests/app/bootstrap.test.ts tests/shared/config.test.ts tests/tui/runtime.test.ts tests/smoke.test.ts`

Expected: PASS.

**Step 2: Run full repository verification**

Run:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Expected: PASS.

**Step 3: Run final runtime checks**

Run:

- `npm run start:mvp`
- `npm run start:wechat`

Expected:

- `start:mvp` remains the dedicated smoke verifier
- `start:wechat` is the real runtime entrypoint and does not route through smoke behavior
- both commands fail clearly, not opaquely, when mandatory env is missing

**Step 4: Update Ralph tracking**

Update `ralph/prd.json` and `ralph/progress.txt` so they describe the deliverable internal MVP productization slice.

Mark stories complete only after Step 2 passes.

**Step 5: Commit**

```bash
git add ralph/prd.json ralph/progress.txt .env.example README.md docs/plans/README.md src/main-entrypoint.ts src/app/bootstrap.ts src/shared/config.ts tests/app/entrypoint.test.ts tests/app/bootstrap.test.ts tests/shared/config.test.ts tests/tui/runtime.test.ts package.json
if needed: git add any minimal follow-up fixes from verification
git commit -m "feat: productize deliverable internal mvp runtime"
```