# Runnable MVP Smoke Slice Design

## Summary

Implement the smallest runnable end-to-end MVP slice on top of the current `master` branch by closing the auto-approved execution path first. The immediate goal is not to finish the full approval/TUI architecture, but to make the repository actually runnable: simulate one trusted admin WeChat message, plan one action through a deterministic provider, execute one auto-approved tool, record the result, and emit a final reply.

## Why This Slice

The current repository already contains the long-term module boundaries for `app`, `agent`, `tasks`, `tools`, `wechat`, `store`, and `tui`, but the root runtime is still not closed:

- `package.json` exposes only `test` and `typecheck`
- `src/app/main.ts` is still an echo stub
- the runtime/provider/tool/task pieces exist mostly as thin wrappers or type scaffolds
- there is no real startup path that composes the modules into a smoke-runnable application

That makes the highest-value next step a narrow runnable smoke slice rather than a broad architectural jump.

## Product Goal for This Slice

A local developer should be able to run one command and observe the following flow:

1. startup loads configuration
2. a simulated trusted admin WeChat message enters the app
3. runtime produces a plan with one auto-approved tool action
4. the tool action executes through the registry
5. the task records thread/event state
6. a final reply is produced and printed/logged

This becomes the first real runnable baseline for the MVP.

## Scope

### In Scope

- add a real runnable entrypoint or runner command
- upgrade `src/app/main.ts` from echo behavior to orchestration behavior
- wire together config, gateway, runtime, task service, approval engine, and tool registry
- use a deterministic fake provider for the first smoke slice
- support one minimal auto-approved tool path, preferably `web.search`
- record enough task/thread events to make the flow inspectable
- emit clear console output for smoke verification
- preserve current module boundaries so later approval/TUI work can attach cleanly

### Out of Scope

- real OpenAI-compatible HTTP provider calls
- real WeChat transport integration
- full approval pause/resume flow
- TUI rendering or operator interaction loop
- full SQLite-backed recovery and restart continuation
- rich retries, background jobs, or production deployment concerns

## Recommended Approach

### Chosen Approach

Build a thin runnable smoke runner around the current layered modules and intentionally keep planning deterministic.

The runner should:

- load env/config
- build a fake provider
- build a minimal tool registry with stubbed runner implementations
- build the app orchestration layer
- simulate one inbound admin message via the gateway
- print the resulting thread progress and final reply

This approach makes the repo runnable immediately while avoiding premature complexity from approvals, real transport, or a networked provider.

### Alternatives Considered

#### 1. Full approval + TUI in the same step

Rejected for now because it is too large for the first runnable closure. It would force approval persistence, operator interactions, and more state management before the core happy path is proven.

#### 2. Startup/composition only, without closing the runtime loop

Rejected because it would still leave the repository in a “starts but does not really work” state. The main value of this slice is proving the loop, not just process startup.

## Architecture for This Slice

### `src/app/main.ts`

`createApplication()` becomes the orchestration boundary.

It should:

- accept injected dependencies for admin boundary, runtime, approvals, tools, task service, and reply delivery
- reject non-admin messages
- create or reuse a thread from the task service
- call `runtime.planNext(...)`
- classify returned actions through the approval engine
- immediately run auto-approved actions through the tool registry
- record events for message receipt, planning, tool completion, and final completion
- emit a final reply

For this slice, if any approval-required action is returned, the app should fail clearly or record that the path is not yet implemented rather than silently continuing.

### `src/agent/*`

The planner/runtime/provider boundaries stay intact.

For this slice:

- `runtime` continues delegating to `planner`
- `planner` continues delegating to `provider.plan(...)`
- the runner injects a deterministic fake provider that returns a stable `reply + actions` payload

This keeps the provider boundary stable while avoiding network complexity.

### `src/tools/*`

The tool registry remains the execution boundary.

For this slice, the smallest supported tool path should be:

- `web.search` as a stub that returns deterministic search results

Optional additional stub:

- `wechat.reply` if needed as a thin wrapper over the reply transport

The first smoke path should avoid `shell.exec` to keep security and workspace-sandbox concerns out of the initial closure.

### `src/tasks/*`

The task service should remain lightweight but must become event-aware enough for smoke execution.

For this slice it should support:

- creating/reusing a thread
- returning a thread ID
- recording a small event timeline in memory
- exposing thread state for tests and smoke output

This is enough to support the first runnable loop while leaving full persistence as the next step.

### `src/wechat/gateway.ts`

The gateway remains an abstraction layer.

For this slice it only needs to:

- accept a simulated inbound message
- forward it into the app message handler

No real transport integration is needed yet.

### New Runnable Entrypoint

Add a small composition entrypoint, for example:

- `src/cli.ts`
- or `src/bin/run-mvp.ts`

The file should compose all dependencies and trigger one smoke-run path.

The command should be exposed from `package.json`.

## Execution Flow

The minimal runnable flow for this slice is:

1. load configuration from env
2. build task service
3. build fake provider
4. build runtime
5. build approval engine
6. build tool registry with stubbed `web.search`
7. build app orchestration layer
8. build gateway with the app as message sink
9. inject one inbound admin message
10. receive a deterministic plan
11. auto-approve and execute `web.search`
12. append tool-completed and thread-completed events
13. send/print final reply

## Data and State

This slice does not require full persistence.

The first runnable implementation may keep thread and event state in memory as long as:

- thread creation is explicit
- events are inspectable in tests
- state transitions are visible in smoke output

Future slices can swap the same interfaces onto SQLite-backed repositories.

## Error Handling

Keep error handling conservative and visible.

### Must Handle

- non-admin message -> ignore or reject clearly
- provider failure -> record failure event and emit failure reply
- unsupported tool -> explicit error
- tool runner failure -> record failure event and emit failure reply

### Do Not Add Yet

- retries
- rollback logic
- automatic recovery
- approval continuation logic

## Testing Strategy

### Unit / Integration Boundary

Add focused tests for:

1. app orchestration happy path
   - inbound admin message
   - runtime emits `web.search`
   - tool runs
   - final reply sent

2. entrypoint composition
   - env -> config -> app + gateway + runner composition succeeds

3. runner/command smoke path
   - either via a lightweight test harness or a verified command invocation

### Verification Commands

At minimum this slice should pass:

- `pnpm test`
- `pnpm typecheck`
- one smoke command that exercises the runnable path

## Success Criteria

This slice is complete when:

- the repo exposes a runnable startup command
- one simulated trusted admin message can be processed end-to-end
- one auto-approved tool action executes through the registry
- the app emits a final reply
- the smoke path is visible in logs or captured in tests
- tests and typecheck remain green

## Follow-Up After This Slice

Once the auto-approved happy path is stable, the next slice should add:

1. approval-required action handling
2. approval request state and persistence
3. approval resume/continuation
4. TUI/operator projection for pending approvals
5. eventual real provider HTTP integration

## Decision

The repository will first implement a runnable smoke slice that closes the auto-approved path using a deterministic fake provider and stubbed `web.search`, while preserving the current architecture and leaving approval/TUI/runtime-deepening work for the next slice.