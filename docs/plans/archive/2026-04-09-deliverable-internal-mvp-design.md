# Deliverable Internal MVP Design

## Summary

This design defines what it means for WeChat Claw to become a directly deliverable MVP for internal technical colleagues. The target is not a general-purpose agent platform and not a polished end-user product. The target is a single-machine internal WeChat Agent that another engineer can install, configure, start, operate, restart, and hand off without reading the source code.

The current repository already proves the core loop in a smoke path: trusted-admin message in, provider planning, approval creation, approval resume, and final thread completion. What is missing is the productized runtime surface around that loop: a real long-running entrypoint, real WeChat operation, restart recovery guarantees, clear diagnostics, and handoff-grade documentation.

## Product Boundary

The deliverable MVP is a single-machine internal operations tool with these boundaries:

- input surface: real WeChat admin messages
- execution surface: restricted tool calls plus approval gating
- control surface: local TUI
- persistence: SQLite
- model backend: one configurable OpenAI-compatible provider
- runtime mode: long-running local process, not only a one-shot smoke script

This design explicitly includes:

- reproducible local installation on a new machine
- real WeChat gateway connectivity and validation
- restart recovery for unfinished threads and pending approvals
- TUI support for daily operator workflows
- minimal runbook coverage for setup, startup, troubleshooting, and handoff

This design explicitly excludes:

- multi-operator collaboration
- web admin console
- multi-tenant isolation
- clustered deployment or HA
- plugin-platform abstractions

## Required MVP Outcomes

A directly deliverable internal MVP must satisfy all of the following:

1. A technical colleague can install dependencies and configure the system from docs alone.
2. The system can receive and process a real WeChat admin message through the real runtime path.
3. High-risk actions pause for approval and can be resumed or rejected from the local operator surface.
4. Pending threads and approvals survive process restart and remain actionable.
5. Operators can diagnose startup and runtime failures from clear logs and documentation.
6. The repository includes handoff-grade setup and operations guidance.

## Architecture

### Entry Points

The product should keep separate entrypoints for validation and real operation:

- `src/smoke.ts`: keep as the one-command smoke verifier
- `src/main.ts`: add as the real long-running runtime entrypoint
- `src/cli.ts`: keep as an auxiliary operator interface, not the primary long-running runtime

Recommended command split:

- `start:mvp`: build and run the smoke verifier
- `start:wechat` or `start:prod`: build and run the real application entrypoint

This separation preserves deterministic smoke verification while preventing smoke-specific behavior from leaking into the operator runtime.

### Bootstrap Composition

`bootstrapApplication(...)` should remain the single application composition boundary. The deliverable MVP should extend it with two guarantees:

1. startup failures are classified by domain: config, provider, database, gateway
2. recovery of unfinished state is explicit and observable during startup

The long-running entrypoint should only orchestrate lifecycle:

- load config
- bootstrap runtime
- initialize or attach the gateway listener
- start TUI runtime
- install signal handlers for graceful shutdown

### WeChat Gateway Contract

The gateway path should become a first-class runtime contract rather than only a smoke seam.

Required behavior:

- inbound messages carry source user identity and timing metadata
- gateway startup and connection failures produce actionable errors
- disconnect/reconnect state is visible through logs and, where appropriate, TUI status
- inbound processing failures are traceable to a specific message or thread

The goal is diagnosability, not distributed resilience.

### Task and Approval Semantics

The task and approval path already exists, but the deliverable MVP needs stronger operational guarantees:

- pending → approved/rejected transitions remain consistent across restart
- pending approvals are still discoverable and actionable after restart
- resume/reject actions are idempotent against duplicate operator input
- final thread state remains queryable after action completion

### Storage and Migration

SQLite remains the persistence layer for the MVP. Delivery quality requires:

- startup migrations continue to run automatically
- database path validation and write-permission failures are explicit
- recovery from an existing database is part of the supported path
- empty-db startup and restart recovery are both covered by verification

### Observability and Operations

The runtime should adopt a minimal but consistent operations contract:

- structured or at least consistently formatted info/warn/error logging
- startup logs summarize critical config in a safe, redacted way
- fatal errors point to the next corrective action
- runtime logs make it obvious whether the failure belongs to config, gateway, provider, db, or approval execution

## Data Flow

### Real Runtime Flow

1. Operator starts the long-running runtime entrypoint.
2. The process validates config and bootstraps the application.
3. Storage migrations run and persisted state becomes available.
4. The WeChat gateway connects and begins receiving trusted-admin messages.
5. The app routes the message into planning.
6. The provider returns reply content and optional tool actions.
7. Safe actions run automatically; risky actions create pending approvals.
8. The operator sees pending work in the TUI.
9. The operator approves or rejects the action.
10. The app resumes execution and persists final thread state.

### Restart Recovery Flow

1. The process exits or crashes while approvals or threads remain unfinished.
2. The operator restarts the runtime.
3. Bootstrapping loads persisted threads, approvals, and event state.
4. TUI surfaces pending approvals and relevant thread history again.
5. The operator can continue the flow without losing context.

## Acceptance Criteria / Definition of Done

The deliverable MVP is complete only when all of the following are true:

1. Installation is reproducible on a new machine using only repository docs.
2. `npm test` and `npm run build` pass from a clean setup.
3. A real runtime command such as `npm run start:wechat` starts successfully without using smoke-only behavior.
4. A real WeChat admin message can drive the system through planning, approval, execution, and reply.
5. A pending approval remains visible and actionable after process restart.
6. Config, provider, gateway, and database failures produce distinct and actionable error messages.
7. README, `.env.example`, and an operator runbook are sufficient for handoff to another engineer.

## Milestones

### M1: Productize runtime entrypoints

- add the real runtime entrypoint
- preserve `start:mvp` as the smoke verifier
- define command semantics and exit codes

Milestone acceptance:

- smoke and real-runtime entrypoints both exist and are intentionally separated

### M2: Stabilize real WeChat operation

- wire the real gateway path as the supported runtime mode
- improve gateway/provider/config diagnostics
- establish minimal runtime logging

Milestone acceptance:

- real inbound messages reach the application and failures are diagnosable

### M3: Guarantee restart recovery

- persist and restore pending approvals and unfinished threads
- harden approval state transitions and idempotency
- add restart-recovery verification coverage

Milestone acceptance:

- restart during a pending approval does not lose operator context or actionability

### M4: Finish the delivery package

- add `.env.example`
- rewrite README for setup/startup/handoff
- add runbook and troubleshooting notes
- define final smoke and real-runtime acceptance checks

Milestone acceptance:

- another internal engineer can install, start, and operate the system from docs alone

## Testing Strategy

Testing for this productized MVP should cover four layers:

### Unit tests

Continue focused coverage for config, gateway, task, approval, store, and TUI logic.

### Composition tests

Verify the composed runtime produced by `bootstrapApplication(...)` still wires the expected boundaries together.

### Recovery tests

Add explicit tests for: persisted pending approval → process restart → reload state → approve/reject succeeds.

### Delivery verification

Maintain both runtime verification paths:

- smoke verification through `start:mvp`
- real-runtime startup verification through the production entrypoint
- doc-driven validation using the actual README setup flow

## Risks and Mitigations

### Risk: real WeChat integration remains fragile

Mitigation: treat gateway behavior as a supported runtime contract, improve diagnostics, and maintain an explicit integration checklist.

### Risk: provider responses are inconsistent

Mitigation: validate the provider contract clearly and surface provider contract failures explicitly instead of silently degrading.

### Risk: restart leaves state inconsistent

Mitigation: add focused recovery tests around pending approvals and thread rehydration, and make approval actions idempotent.

### Risk: documentation drifts behind implementation

Mitigation: make docs and `.env.example` part of the Definition of Done rather than post-hoc cleanup.

## Recommended Approach

The recommended approach is a single-machine deliverable operations build, not a half-productized UI push and not a platform-first architecture refactor. This keeps scope aligned with the current repository shape and delivers the shortest path from “core smoke loop exists” to “another engineer can run and operate this system.”

## Follow-On Work

After this MVP is delivered, likely next steps include:

1. richer operator UX for approvals and thread inspection
2. deeper provider compatibility and contract enforcement
3. browser or desktop automation expansion after the single-machine agent runtime is stable
