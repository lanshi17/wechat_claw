# WeChat Agent TUI MVP Design

## Summary

Build a Linux-first TypeScript TUI application that uses WeChat as the remote control surface for a local coding and research agent. The MVP keeps the existing layered architecture, but upgrades the repository from a test-only skeleton into a runnable local application that can receive a trusted admin message, plan actions with an LLM provider, run auto-approved tools immediately, pause risky actions for TUI approval, and send progress plus final results back to WeChat.

## Product Definition

The MVP is a local operator console for one trusted WeChat administrator.

The administrator can send natural-language requests over WeChat to:

- ask questions
- search the web and summarize findings
- analyze images sent through WeChat
- read files in the local workspace
- request file edits or shell commands that require local approval
- receive intermediate status and final results back in WeChat

The local TUI is the control plane. It shows threads, logs, pending approvals, and final outcomes. High-risk actions require confirmation in the TUI before execution.

## Goals

- Provide a usable end-to-end remote coding and research workflow over WeChat.
- Preserve architecture boundaries so later expansion to richer browser or desktop automation does not require a rewrite.
- Keep the MVP small enough to run locally with stubbed integrations where the real external systems are not ready yet.
- Add a real application entrypoint and package scripts so the repository is runnable, not only testable.

## Non-Goals

- Mouse or keyboard control for arbitrary desktop applications
- Window management and full GUI automation
- Multi-user access control
- Long-running autonomous background jobs
- Rich workflow policy language or per-tool sandboxing
- Production-grade distributed deployment
- Solving real WeChat transport reliability beyond the current gateway abstraction

## Constraints

- Linux is the primary target for the first release.
- The system supports exactly one configured WeChat administrator.
- The LLM backend is pluggable across multiple providers.
- Threads are first-class: one administrator can have multiple active or historical tasks.
- Approval mode is mixed: low-risk actions auto-run, high-risk actions pause for TUI confirmation.
- File and shell access must stay inside the configured workspace root.

## Architecture

The codebase keeps a layered single-machine architecture. The first release runs in one Node.js process, but module boundaries match the long-term design.

### Core Modules

`app-entry`

- loads and validates configuration
- opens the SQLite database and applies migrations
- instantiates repositories and projections
- builds the provider, planner, runtime, approval engine, tool registry, task service, TUI, and gateway
- starts the local loop and exposes a small runnable API for tests and CLI startup

`wechat-gateway`

- wraps the WeChat transport abstraction
- receives inbound messages and attachments
- enforces the trusted administrator boundary before work enters the task flow
- sends progress and final replies back through `wechat.reply`

`task-service`

- creates and updates task threads
- maps inbound messages to a new thread or an existing active thread
- tracks lifecycle states such as `queued`, `planning`, `waiting_approval`, `running`, `done`, and `failed`
- persists lifecycle and tool events so the TUI can project current state

`agent-runtime`

- builds prompt context from thread history, tool results, and attachment metadata
- calls the configured LLM provider
- converts the model response into structured tool actions or chat replies
- re-enters planning after tool completion until the task is done

`approval-engine`

- classifies tool actions by risk
- auto-approves safe reads and summaries
- creates approval requests for shell execution and file writes

`tool-runners`

- executes concrete actions behind stable interfaces
- MVP tool set is limited to `shell`, `fs`, `web`, `vision`, and `wechat`
- all runners return structured outputs that can be persisted and rendered in the TUI

`event-store`

- persists threads, message records, tool executions, approvals, and artifacts
- allows the TUI to recover state after restart and replay execution history

`tui-app`

- shows thread list, selected thread timeline, pending approvals, and live logs
- exposes an approval action surface that can approve or reject risky actions
- projects event-store state into a stable view model

## MVP Tool Surface

The MVP intentionally limits the tool API to the smallest set that closes the user workflow.

### Auto-Approved Tools

- `wechat.reply`: send progress or final text back to WeChat
- `fs.read`: read files or small directory listings inside the allowed workspace
- `web.search`: search the web and return normalized result summaries
- `web.fetch`: fetch a URL and extract readable text
- `vision.analyze`: analyze an image attachment using a vision-capable provider

### Approval-Required Tools

- `shell.exec`: run shell commands, capture stdout, stderr, exit code, and duration
- `fs.write`: create or edit files in the local workspace

This approval boundary is fixed for the MVP and should be implemented exactly as above.

## Thread Model

Threads are the user-visible unit of work.

- Every inbound admin message either creates a new thread or attaches to the most recent unfinished thread.
- Each thread has a title, status, timestamps, a running summary, and a message/event timeline.
- The TUI shows all threads with their latest state.
- WeChat replies include the thread identifier when useful so the operator can correlate status with the TUI.

## Execution Flow

1. The WeChat gateway receives a message or image from the configured administrator.
2. The task service creates or resumes a thread and records the inbound event.
3. The agent runtime builds context from the thread timeline plus any attachment metadata.
4. The LLM emits either a direct answer or a structured action plan.
5. Each action is checked by the approval engine.
6. Auto-approved actions run immediately.
7. High-risk actions create approval requests and pause the thread.
8. The TUI operator approves or rejects the action.
9. Tool results are recorded as task events and fed back into the agent runtime until the task finishes.
10. The system sends a final WeChat reply with the result summary and relevant outputs.

## Data Model

SQLite is sufficient for the MVP and keeps persistence local and debuggable.

### Required Tables

`wechat_session`

- saved token, account ID, base URL, sync buffer

`admins`

- trusted WeChat administrator identity and last-seen metadata

`threads`

- thread ID, title, state, source user, timestamps, summary

`messages`

- inbound and outbound WeChat message records, attachment metadata, and thread linkage

`task_events`

- planning steps, tool requests, tool outputs, state changes, errors

`approval_requests`

- requested action, risk reason, edited payload, decision, approver, timestamps

`artifacts`

- file outputs, fetched pages, or derived image-analysis records

## TUI Design

The TUI should favor visibility and control over aesthetic complexity.

### Primary Areas

- left pane: thread list with status and active selection
- center pane: timeline for the selected thread showing inbound messages, plans, tool calls, approvals, and outputs
- right pane: pending approvals and artifact summary
- bottom pane: shortcuts, current provider, and command hints

### Required TUI Actions

- switch thread selection
- inspect the latest tool calls and outputs
- approve once
- reject with an operator note
- show current pending approval count

The existing view-model-oriented TUI code can stay lightweight for the MVP. A rich interactive terminal is not required before the end-to-end loop works.

## Provider Model

The LLM layer should use a capability-based provider interface.

Each provider advertises:

- text generation support
- tool-calling or structured-output support
- image input support

The runtime should fail clearly when a requested tool path depends on provider capabilities that are unavailable, such as image analysis with a text-only model.

## Configuration

Configuration comes from environment variables.

Required configuration includes:

- admin WeChat user ID
- LLM provider type and credentials when needed
- default model name
- SQLite database path
- allowed workspace root for file and shell operations

The runnable entrypoint should also support sensible local defaults for smoke testing where possible.

## Error Handling

- Non-admin inbound messages are ignored and recorded as rejected input when useful.
- Provider failures are recorded as task events and summarized for both the TUI and WeChat.
- Tool failures are recorded as structured events with stderr or error messages.
- Threads remain resumable after failure.
- Approval rejections are explicit thread events so the agent can revise or end its plan.
- Workspace-root violations are rejected before tool execution.

## Security Posture

The MVP is intentionally conservative.

- Only one configured administrator can issue commands.
- Writes and shell execution require TUI approval.
- File access is limited to configured workspace roots.
- The system stores an auditable local event log for every action.

## Phased Expansion

After the MVP proves stable, the next expansion layers are:

1. browser automation with Playwright actions
2. desktop automation for Linux
3. richer approval policies and reusable approvals within a thread
4. multi-user access control and remote deployment modes

The MVP architecture should make those additions incremental rather than structural rewrites.
