# Admin Boundary + Approval Flow Slice Design

## Summary

This slice hardens the runnable MVP at the trust and control boundary. It ensures only the configured WeChat administrator can enter the orchestration flow through the gateway, and it makes approval-required actions pause and resume in a way that is explicit, testable, and aligned with the MVP design.

## Scope

This slice includes exactly two outcomes:

1. Enforce trusted-admin filtering in the WeChat gateway.
2. Tighten approval-required action handling in the application loop, including pause, acknowledgement, and resume semantics.

## Non-Goals

This slice does not include:

- thread continuation or active-thread attachment changes
- deeper TUI rendering or approval interaction work
- provider/runtime redesign
- real WeChat transport work
- approval-policy expansion beyond the MVP boundary
- persistence redesign

## Current State

The repository already has the primitives needed, but the behavior is still only partially aligned with the MVP design:

- `src/wechat/gateway.ts` forwards every inbound message directly to `onMessage`
- `tests/wechat/gateway.test.ts` only proves forwarding for an admin message
- `src/app/main.ts` already checks `adminUserId` inside `handleAdminMessage(...)`, but that leaves the gateway boundary too permissive
- `src/app/main.ts` already pauses approval-required actions, but the behavior should be tightened and covered as an explicit slice outcome rather than left as incidental behavior
- `src/approval/engine.ts` and `src/approval/policies.ts` already encode the MVP rule that `shell.exec` and `fs.write` require approval

## Architecture

### WeChat Gateway Boundary

The gateway should become the first enforcement layer for the single trusted admin. It should accept `adminUserId` in its dependencies and drop non-admin inbound messages before they enter the app loop.

This keeps the trust boundary close to the transport edge and aligns with the 2026-03-24 MVP design, where the gateway is responsible for filtering before work enters task orchestration.

### Application Loop Approval Behavior

The application loop should keep a small, deterministic policy:

- every planned action is classified by the approval engine
- `auto_approve` actions run immediately and append tool-completed events
- `approval_required` actions create an approval request, mark the thread `waiting_approval`, send an operator-facing acknowledgement, and stop further execution for that turn
- `resumeApproval(...)` executes the stored action, appends the completion event, marks the thread done, and sends the stored reply

The slice should not introduce richer approval editing, retries, batching, or new policy categories.

## Data Flow

1. A WeChat inbound message arrives at the gateway.
2. The gateway forwards only if `fromUserId` matches the configured admin.
3. The application creates or resumes thread state and requests a plan from the runtime.
4. Each planned action is classified by the approval engine.
5. Safe actions run immediately.
6. Risky actions create approval state, pause the thread, and notify the operator.
7. On approval resume, the stored action executes and the thread completes.

## Testing Strategy

This slice should be implemented with strict TDD.

### Gateway tests

`tests/wechat/gateway.test.ts` should prove both behaviors:

- admin messages are forwarded unchanged
- non-admin messages are ignored

### Application tests

`tests/app/main.test.ts` should prove:

- auto-approved actions still execute and send the final reply
- approval-required actions do not run immediately
- approval-required actions create approval state, mark waiting status, and send an acknowledgement
- resumed approvals execute the stored action and complete the thread

### Approval policy tests

`tests/approval/engine.test.ts` should only be touched if needed to pin the exact MVP boundary (`shell.exec` and `fs.write` require approval, everything else remains auto-approved).

## Risks and Mitigations

### Risk: Duplicate admin checks become inconsistent

Mitigation: keep the gateway as the first filter, but preserve the application-level guard as a defensive backstop unless tests show it adds noise.

### Risk: Slice turns into broader runtime refactoring

Mitigation: do not modify provider, planner, runtime, or task-service abstractions except for minimal type compatibility if absolutely necessary.

### Risk: Approval behavior grows beyond MVP

Mitigation: keep the flow single-action and deterministic; no new approval UX or policy dimensions.

## Success Criteria

This slice is complete when:

- `src/wechat/gateway.ts` enforces the trusted-admin boundary
- gateway tests cover both allowed and ignored inbound messages
- `src/app/main.ts` expresses approval pause/resume behavior clearly and minimally
- app tests cover auto-approved, paused, and resumed flows
- approval policy remains aligned with `shell.exec` and `fs.write` as the only approval-required tools
- focused tests and root verification remain green

## Follow-On Work

After this slice lands, the next likely slices are:

1. thread continuation and active-thread attachment behavior
2. deeper TUI rendering and approval interaction
3. higher-level end-to-end integration around the full WeChat control loop
