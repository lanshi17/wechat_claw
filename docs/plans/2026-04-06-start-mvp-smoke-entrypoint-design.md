# Start MVP Smoke Entrypoint Design

## Summary

This slice makes `npm run start:mvp` behave like the repository documentation says it behaves. Instead of compiling the project and invoking the general-purpose CLI with no arguments, the command should run a dedicated smoke entrypoint that boots the app, simulates one trusted-admin inbound message, waits for an approval request, auto-approves that request, and prints the final thread status.

The goal is not to ship a full product entrypoint. The goal is to make the existing MVP smoke loop real, deterministic, and testable without changing the semantics of the reusable operator CLI.

## Scope

This slice includes exactly six outcomes:

1. Add a dedicated smoke runner for the one-command MVP path.
2. Keep the existing `message`, `approve`, `reject`, and `tui` CLI commands unchanged.
3. Repoint `start:mvp` to the dedicated smoke runner.
4. Detect the new approval created by the simulated admin message and resume it automatically.
5. Fail loudly when the provider does not create an approval-required action.
6. Update repository docs so the described startup flow matches the actual command behavior.

## Non-Goals

This slice does not include:

- a real WeChat transport integration
- replacing the default entrypoint's stubbed tool runners with a full production tool surface
- adding a new interactive CLI mode
- changing TUI behavior
- automatic retry logic for provider failures
- configurable smoke prompts, multi-step smoke scripts, or a scenario framework
- broader runtime composition cleanup outside what the smoke entrypoint needs

## Current State

The repository already has the pieces needed for a smoke loop:

- `bootstrapApplication(...)` returns a composed app, gateway, and repository-backed task service
- `createApplication(...)` already supports approval creation, approval resume, and final thread completion
- `TaskService` can list approvals and threads, which is enough to detect the approval created by a smoke run
- repository-level tests, typecheck, and build all pass on the current branch

The mismatch is at the startup surface:

- `package.json` points `start:mvp` at `node dist/cli.js`
- `src/cli.ts` treats missing subcommands as usage errors
- running `npm run start:mvp` currently exits with usage output instead of performing the documented smoke loop
- `README.md` describes a one-command approval pause/resume flow that is not what the current script does

## Architecture

### Dedicated Smoke Entrypoint

Add a new top-level runtime file, `src/smoke.ts`, as the only entrypoint for the smoke path. It should expose a pure, injectable `runMvpSmoke(...)` function for tests and a tiny `main()` wrapper for the command-line entrypoint.

This keeps concerns separated:

- `src/cli.ts` remains the reusable operator interface
- `src/smoke.ts` becomes the scripted smoke-verification interface

### Bootstrap Reuse

The smoke runner should reuse `bootstrapApplication(...)` exactly as the CLI does. It should not create a second composition path or duplicate config loading.

The smoke runner should rely on the existing returned runtime values:

- `gateway` to simulate an inbound trusted-admin message
- `app` to resume the approval once detected
- `taskService` to inspect approvals and the final thread status

Using `gateway.handleInbound(...)` is preferable to calling `app.handleAdminMessage(...)` directly because the smoke path should still cross the trusted-admin boundary and the current gateway wiring already sets the message context needed by the entrypoint.

### Approval Detection

The smoke runner should detect the approval created by the current run by comparing approval IDs before and after the inbound message is processed.

Recommended algorithm:

1. Read the existing approval IDs from `taskService.listApprovals()`.
2. Send the scripted admin message through `gateway.handleInbound(...)`.
3. Read approvals again.
4. Find the new approval whose ID was not present in the initial set and whose status is `pending`.

This avoids depending on a clean database and makes the smoke runner robust when the configured SQLite file already contains older approvals.

### Success and Failure Semantics

The smoke runner should print a small, human-readable trace:

- the submitted smoke message
- the detected approval ID
- the final thread status after resume

The smoke runner should fail with exit code `1` when:

- bootstrap throws
- no new pending approval is created by the smoke message
- the resumed thread cannot be resolved to a final status

This is important because the smoke command is meant to assert the approval-driven MVP path, not merely exercise some code.

### Prompt Choice

The smoke message should be a fixed trusted-admin prompt, not a user-configurable scenario for this slice. A concise prompt that strongly suggests an approval-required `shell.exec` action is enough.

If the provider still responds with plain text or only auto-approved actions, the smoke runner should report that the provider output did not satisfy the smoke contract and exit non-zero.

## Data Flow

1. The operator runs `npm run start:mvp`.
2. The command builds the project and starts `dist/smoke.js`.
3. `runMvpSmoke(...)` bootstraps the app through `bootstrapApplication(...)`.
4. The smoke runner snapshots existing approvals from `taskService.listApprovals()`.
5. The smoke runner sends a fixed trusted-admin message through `gateway.handleInbound(...)`.
6. The composed app asks the provider for a plan and creates a pending approval if the returned action requires approval.
7. The smoke runner finds the newly created pending approval.
8. The smoke runner calls `app.resumeApproval(approvalId)`.
9. The smoke runner reads the thread status through `taskService.getThread(threadId)`.
10. The smoke runner prints the approval ID and final thread status, then exits `0`.

## Testing Strategy

This slice should stay TDD-first and avoid real network calls in tests.

### Smoke runner tests

Create focused tests for `runMvpSmoke(...)` that prove:

- a successful run submits one inbound message, resumes the newly created approval, and prints the final thread status
- the runner returns non-zero and prints a clear error when no new pending approval appears

These tests should inject a fake `bootstrapApplication(...)` result rather than call the real provider or SQLite path.

### Existing regression coverage

Keep the existing CLI tests green to prove that adding `src/smoke.ts` does not change the reusable command surface.

Keep repository-level verification green:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

## Risks and Mitigations

### Risk: The smoke runner mutates CLI semantics indirectly

Mitigation: do not route `start:mvp` through `src/cli.ts`. Add a separate entrypoint file and leave the CLI contract unchanged.

### Risk: Existing approvals in SQLite cause the wrong approval to be resumed

Mitigation: compare approval IDs before and after the inbound message and only resume a newly created pending approval.

### Risk: The smoke path silently succeeds without proving the approval flow

Mitigation: fail non-zero when no new pending approval is created or when a final thread status cannot be resolved.

### Risk: Tests accidentally depend on network or provider output

Mitigation: test the smoke runner through dependency injection and stubbed runtime objects only.

## Success Criteria

This slice is complete when:

- `npm run start:mvp` runs a dedicated scripted smoke loop instead of printing CLI usage
- the smoke path simulates one trusted-admin inbound message through the existing gateway
- the smoke path automatically resumes the newly created approval
- the command prints the approval ID and final thread status
- the command fails clearly when the provider does not return an approval-required action
- README startup instructions match the actual command behavior
- focused tests, full tests, typecheck, and build remain green

## Follow-On Work

After this slice lands, the next likely MVP gaps are:

1. replacing the default entrypoint's stubbed tool runners with real local implementations
2. wiring a real WeChat ingress/egress adapter instead of a simulated gateway-only path
3. improving provider contract handling so the smoke path can validate response shape more explicitly
