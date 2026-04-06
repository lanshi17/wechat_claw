# TUI Approval Interaction Implementation Plan

> **Status:** Implemented in repository history. Repository-level verification was refreshed on 2026-04-06 with `npm test`, `npx tsc --noEmit`, and `npm run build`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal interactive TUI that can navigate approvals, approve a selected item, and reject with a typed reason, all through the existing application approval APIs.

**Architecture:** Extend `TaskService` with the read-side queries needed by a live operator view, keep `src/tui/app.ts` as the view-model projector, add a small controller/runtime for keyboard interaction, and wire it into the CLI as a new `tui` command. Do not introduce a third-party TUI library.

**Tech Stack:** TypeScript, Vitest, Node `stdin`/`stdout`, existing app/task-service/TUI modules, zero additional runtime dependencies.

---

### Task 1: Add task-service query APIs for the live TUI

**Files:**
- Modify: `tests/tasks/service.test.ts`
- Modify: `src/tasks/service.ts`
- Modify: `src/store/repositories/threads.ts` only if a small list helper is needed
- Modify: `src/store/repositories/approvals.ts` only if a small list helper is needed

**Step 1: Write the failing tests**

Extend `tests/tasks/service.test.ts` with focused cases that prove:

- `listThreads()` returns created threads in stable order
- `listApprovals()` returns created approvals with current statuses in stable order
- the same queries work in repository-backed mode

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tasks/service.test.ts`

Expected: FAIL because the service does not yet expose list queries for threads and approvals.

**Step 3: Write minimal implementation**

Add read-only query helpers to `TaskService` and repository helpers only if required:

- `listThreads()`
- `listApprovals()`

Keep return shapes small and normalized. Do not return UI-specific labels.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tasks/service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tasks/service.test.ts src/tasks/service.ts src/store/repositories/threads.ts src/store/repositories/approvals.ts
git commit -m "feat: add task service query APIs for tui"
```

### Task 2: Add a testable TUI controller/runtime

**Files:**
- Create: `tests/tui/runtime.test.ts`
- Create: `src/tui/runtime.ts`
- Modify: `src/tui/screens/main-screen.ts`
- Modify: `src/tui/widgets/approval-queue.ts` only if a selection-oriented field is needed

**Step 1: Write the failing tests**

Create controller-focused tests that prove:

- selection moves down and up within bounds
- approve dispatches `resumeApproval(...)` for the selected approval
- reject enters input mode, buffers characters, and dispatches `rejectApproval(...)` with the typed reason
- `Esc` cancels reject-input mode without dispatching

Prefer testing controller methods over real terminal streams.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/runtime.test.ts`

Expected: FAIL because the controller/runtime does not exist yet.

**Step 3: Write minimal implementation**

Create a small controller/runtime in `src/tui/runtime.ts` that owns:

- mode (`browse` or `reject_input`)
- selected approval index
- reject reason buffer
- action dispatch to `app.resumeApproval(...)` and `app.rejectApproval(...)`

Do not implement real raw-mode terminal wiring yet if the controller API can be tested first.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tui/runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/runtime.test.ts src/tui/runtime.ts src/tui/screens/main-screen.ts src/tui/widgets/approval-queue.ts
git commit -m "feat: add testable tui approval controller"
```

### Task 3: Render the live screen and wire terminal key handling

**Files:**
- Modify: `tests/tui/app.test.ts`
- Modify: `src/tui/app.ts`
- Modify: `src/tui/runtime.ts`
- Modify: `src/tui/widgets/event-log.ts`
- Modify: `src/tui/widgets/thread-list.ts` only if needed for display shape consistency

**Step 1: Write the failing tests**

Extend TUI tests to prove:

- the selected approval is clearly represented in rendered state
- reject-input mode exposes the current prompt/buffer
- event items for the selected thread are included in the rendered screen state

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/app.test.ts tests/tui/runtime.test.ts`

Expected: FAIL because the existing TUI state does not yet include interactive screen metadata.

**Step 3: Write minimal implementation**

Update the TUI state/render path to include:

- selected approval marker
- footer/help text
- reject-input prompt state
- selected-thread event projection

Keep rendering plain-text and line-based.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tui/app.test.ts tests/tui/runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts tests/tui/runtime.test.ts src/tui/app.ts src/tui/runtime.ts src/tui/widgets/event-log.ts src/tui/widgets/thread-list.ts
git commit -m "feat: render interactive tui approval state"
```

### Task 4: Expose the TUI through the CLI

**Files:**
- Modify: `tests/cli.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/app/bootstrap.ts` only if a small seam is needed for runtime startup
- Modify: `src/tui/runtime.ts` only if startup wiring needs a tiny exported helper

**Step 1: Write the failing tests**

Extend `tests/cli.test.ts` with a `tui` command case that proves:

- `runCli(["tui"])` bootstraps the app
- it starts the TUI runtime
- existing `message`, `approve`, and `reject` commands still work unchanged

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cli.test.ts`

Expected: FAIL because the CLI does not yet recognize `tui`.

**Step 3: Write minimal implementation**

Wire `tui` into `src/cli.ts`:

- bootstrap the app
- start the TUI runtime
- preserve current commands and usage text

Do not add a second CLI entrypoint.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cli.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/cli.test.ts src/cli.ts src/app/bootstrap.ts src/tui/runtime.ts
git commit -m "feat: add tui command to cli"
```

### Task 5: Run full verification and update Ralph tracking

**Files:**
- Modify: `ralph/prd.json`
- Modify: `ralph/progress.txt`
- Modify: touched files from Tasks 1-4 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/tasks/service.test.ts tests/tui/app.test.ts tests/tui/runtime.test.ts tests/cli.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npm test`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Update Ralph tracking**

Archive the current completed `ralph/operator-approval-flow` run if you repurpose `ralph/prd.json`, then write a new TUI-interaction PRD and progress file or update them consistently. Mark completed stories as passing only after verification.

**Step 4: Re-run verification if any fixes were needed**

Run the same verification commands again if Step 2 exposed any defects.

**Step 5: Commit**

```bash
git add ralph/prd.json ralph/progress.txt tests/tasks/service.test.ts tests/tui/app.test.ts tests/tui/runtime.test.ts tests/cli.test.ts src/tasks/service.ts src/store/repositories/threads.ts src/store/repositories/approvals.ts src/tui/app.ts src/tui/runtime.ts src/tui/screens/main-screen.ts src/tui/widgets/approval-queue.ts src/tui/widgets/event-log.ts src/tui/widgets/thread-list.ts src/cli.ts src/app/bootstrap.ts
git commit -m "feat: add interactive tui approval controls"
```
