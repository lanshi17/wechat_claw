# WeChat Claw

一个基于 TypeScript 的单机 WeChat Agent MVP，用微信作为远程控制入口，用本地 TUI 作为操作台，目标是把“消息输入 → 规划 → 工具执行 → 审批 → 结果回传”交付成一个内部同事可直接安装、配置、启动和重启恢复的运行时。

A single-machine TypeScript WeChat agent MVP that uses WeChat as the remote control surface and a local TUI as the operator console. The goal is to ship “message input → planning → tool execution → approval → result delivery” as a runtime another internal engineer can install, configure, start, and recover after restart.

## Install

```bash
npm install
```

If you prefer pnpm, `pnpm install` works too.

## Configure

1. Copy the example env file.
2. Replace the placeholders with values for your machine.

```bash
cp .env.example .env
```

Required variables:

- `ADMIN_USER_ID`: trusted admin WeChat user ID
- `WORKSPACE_ROOT`: absolute path to the allowed local workspace
- `LLM_BASE_URL`: reachable OpenAI-compatible base URL
- `LLM_MODEL`: model name to call
- `LLM_API_KEY`: optional API key; leave empty if your provider allows it
- `LLM_SUPPORTS_IMAGE_INPUT`: `true` or `false`
- `DATABASE_PATH`: SQLite database path for threads, approvals, and events

Export the variables from `.env` into your shell before running commands.

## Commands

```bash
npm test
npx tsc --noEmit
npm run build
npm run start:mvp
npm run start:wechat
```

## Smoke verification

`npm run start:mvp` is the dedicated smoke verifier.

It builds the project, bootstraps the composed app, sends one scripted trusted-admin message through the gateway path, waits for a newly created pending approval, auto-resumes that approval, and prints the final thread status.

Use this command to prove the configured provider path, approval flow, and persistence wiring still work end to end.

## Real runtime

`npm run start:wechat` is the real runtime entrypoint.

It builds the project, bootstraps the app, starts the runtime, and launches the TUI without routing through the smoke verifier. This is the command to use for normal operation.

## Restart and recovery expectations

Threads, approvals, and events are persisted in SQLite at `DATABASE_PATH`.

If the process stops while an approval is pending:

- the approval remains stored
- the waiting thread remains stored
- `npm run start:wechat` reloads that state on the next start
- the TUI shows the recovered pending approval again so the operator can approve or reject it

`npm run start:mvp` remains a one-shot verifier. `npm run start:wechat` is the long-running operator path.

## Troubleshooting

### Missing config

Startup failures caused by missing required env values are reported as:

```text
Startup failed [config]: Missing required config: ...
```

Check that every variable from `.env.example` is exported before starting the runtime.

### Unreachable provider

If the OpenAI-compatible endpoint cannot be reached, startup fails with a provider-category message.

Check:

- `LLM_BASE_URL` is correct
- the provider is running
- the model name is valid
- local networking/firewall settings allow access

### Gateway issues

If the runtime cannot initialize the gateway path, startup should fail with a gateway-category message.

Re-check the runtime-specific gateway configuration and any local session prerequisites before retrying.

### Database path problems

If SQLite cannot open or write the configured database, startup should fail with a database-category message.

Check:

- the parent directory exists
- the path is writable
- the file is not locked by another process

## Project structure

```text
src/
  agent/      LLM provider abstraction, planning, runtime
  app/        application composition and bootstrap code
  approval/   approval policies and engine
  shared/     config and schemas
  store/      SQLite access, migrations, repositories
  tasks/      thread routing, task service, state transitions
  tools/      tool registry and tool runners
  tui/        local terminal UI models and widgets
  wechat/     WeChat gateway and session abstractions

docs/
  plans/      active and archived design/implementation docs

tests/
  ...         unit and composition coverage across the runtime
```

## Related docs

- `docs/plans/README.md`
- `docs/plans/2026-04-09-deliverable-internal-mvp-design.md`
- `docs/plans/2026-04-09-deliverable-internal-mvp.md`
