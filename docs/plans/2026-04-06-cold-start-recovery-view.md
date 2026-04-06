# Cold-Start Recovery View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `wechat-claw tui` show an explicit SQLite-backed cold-start recovery scene after restart, while keeping operator actions limited to the existing approve and reject flows.

**Architecture:** Reuse the current repository-backed `TaskService` read model and project recovery semantics inside the TUI layer. Add recovery-specific messaging and selected-thread fallback in the TUI runtime and view-model path, then prove with entrypoint tests that the same SQLite database yields the same recovery view across restarts. Do not reconstruct runtime session state or auto-resume work.

**Tech Stack:** TypeScript, Vitest, Node `stdin`/`stdout`, Better SQLite3, existing app/task-service/TUI modules, zero additional runtime dependencies.

---

### Task 1: Specify cold-start recovery messaging in TUI tests

**Files:**
- Modify: `tests/tui/app.test.ts`
- Check: `src/tui/app.ts`
- Check: `src/tui/screens/main-screen.ts`

**Step 1: Write the failing tests**

Extend `tests/tui/app.test.ts` with focused cases that prove:

- the main screen renders explicit recovery messaging when pending approvals exist
- the screen renders informational recovery messaging when only `failed` or `waiting_approval` threads exist
- the footer/help text does not imply approve or reject actions when no pending approval is selectable

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: FAIL because the current TUI render path does not expose any cold-start recovery banner or recovery-specific help text.

**Step 3: Write minimal implementation**

Update `src/tui/app.ts` and `src/tui/screens/main-screen.ts` so the view model can carry:

- recovery banner text
- recovery mode or recovery hint text
- a footer that distinguishes actionable pending approvals from informational recovered context

Keep the render path plain-text and line-based.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tui/app.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/app.test.ts src/tui/app.ts src/tui/screens/main-screen.ts
git commit -m "feat: project cold-start recovery state in tui"
```

### Task 2: Add selected-thread fallback for recovered context

**Files:**
- Modify: `tests/tui/runtime.test.ts`
- Modify: `src/tui/runtime.ts`
- Check: `src/tui/app.ts`

**Step 1: Write the failing tests**

Extend `tests/tui/runtime.test.ts` with cases that prove:

- initial render uses the selected approval thread when pending approvals exist
- initial render falls back to a `waiting_approval` thread when no approval is selected
- initial render falls back to a `failed` thread when neither a pending approval nor a waiting thread exists

Keep the tests centered on `buildScreenState()` or the smallest pure runtime seam available.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/runtime.test.ts`

Expected: FAIL because the current runtime only derives selected thread context from the selected approval row.

**Step 3: Write minimal implementation**

Update `src/tui/runtime.ts` so selected thread context uses this order:

1. selected pending approval thread
2. latest `waiting_approval` thread
3. latest `failed` thread
4. no selected thread

Do not introduce thread navigation or a second selection mode.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tui/runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/tui/runtime.test.ts src/tui/runtime.ts
git commit -m "feat: keep recovered thread context visible in tui"
```

### Task 3: Prove the recovery view survives process restart

**Files:**
- Modify: `tests/app/entrypoint.test.ts`
- Check: `src/app/entrypoint.ts`
- Check: `src/app/bootstrap.ts`
- Check: `src/tasks/service.ts`

**Step 1: Write the failing test**

Extend `tests/app/entrypoint.test.ts` with a cross-restart case that:

- creates a writer entrypoint using a temporary SQLite database
- persists a recoverable scene such as a pending approval and `waiting_approval` thread, or a failed thread with events
- recreates a reader entrypoint against the same database
- builds the initial TUI state from the reader runtime and expects recovery messaging plus the correct selected thread context

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/entrypoint.test.ts tests/tui/runtime.test.ts`

Expected: FAIL because the current TUI state does not yet present recovered scenes explicitly across cold start.

**Step 3: Write minimal implementation**

Make only the smallest source change needed in already-touched TUI files or in `src/app/entrypoint.ts` if a tiny seam is required for test composition.

Do not add:

- a recovery snapshot object
- a new recovery service
- any boot-time auto-resume logic

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/entrypoint.test.ts tests/tui/app.test.ts tests/tui/runtime.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/entrypoint.test.ts src/tui/app.ts src/tui/runtime.ts src/tui/screens/main-screen.ts src/app/entrypoint.ts
git commit -m "test: prove cold-start recovery view across sqlite restart"
```

### Task 4: Run full verification and update Ralph tracking

**Files:**
- Modify: `ralph/prd.json`
- Modify: `ralph/progress.txt`
- Modify: touched files from Tasks 1-3 only if verification exposes minimal defects

**Step 1: Run the focused verification set**

Run:

- `npx vitest run tests/tui/app.test.ts tests/tui/runtime.test.ts tests/app/entrypoint.test.ts`

Expected: PASS.

**Step 2: Run the full repository verification set**

Run:

- `npm test`
- `npx tsc --noEmit`

Expected: PASS.

**Step 3: Update Ralph tracking**

Archive the current active Ralph run if needed, then write a new cold-start recovery PRD and progress file that matches the completed slice. Mark stories complete only after verification succeeds.

**Step 4: Re-run verification if any fixes were needed**

Run the same verification commands again if Step 2 exposed any defects.

**Step 5: Commit**

```bash
git add ralph/prd.json ralph/progress.txt tests/tui/app.test.ts tests/tui/runtime.test.ts tests/app/entrypoint.test.ts src/tui/app.ts src/tui/runtime.ts src/tui/screens/main-screen.ts src/app/entrypoint.ts
git commit -m "feat: add cold-start recovery view to tui"
```
