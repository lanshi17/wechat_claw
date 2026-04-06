# WeChat Claw

一个基于 TypeScript 的本地 WeChat Agent MVP 项目，用微信作为远程控制入口，用本地 TUI 作为控制台，目标是把“消息输入 → 规划 → 工具执行 → 审批 → 回传结果”串成一个可演进的本地工作流。

A local TypeScript WeChat agent MVP that uses WeChat as the remote control surface and a local TUI as the operator console. The goal is to turn “message input → planning → tool execution → approval → result delivery” into an incremental local workflow.

## 为什么是这个项目 / Why This Project

这个仓库聚焦一个很小但完整的 MVP 闭环：

This repository focuses on a small but complete MVP loop:

- 可信管理员通过 WeChat 发送请求 / A trusted admin sends requests through WeChat
- Agent 结合上下文决定直接回复或调用工具 / The agent decides whether to reply directly or call tools
- 低风险工具自动执行，高风险工具等待本地审批 / Low-risk tools run automatically, while high-risk tools wait for local approval
- 本地 TUI 负责展示线程、日志和审批状态 / A local TUI shows threads, logs, and approval state

## 当前状态 / Current Status

当前仓库已经具备一条可运行的 smoke 路径，但默认入口仍是面向 MVP 收敛的开发切片，而不是完整产品入口。

The repository already has a runnable smoke path, but the default entrypoint is still an implementation slice aimed at converging on the MVP rather than a full product entrypoint.

- 已有基础模块与测试：agent、app、approval、store、tasks、tools、TUI、WeChat gateway / Core modules and tests already exist across agent, app, approval, store, tasks, tools, TUI, and the WeChat gateway
- `start:mvp` 会构建项目并运行专用 smoke 入口 `dist/smoke.js` / `start:mvp` builds the project and runs the dedicated smoke entrypoint at `dist/smoke.js`
- 当前 smoke 流程会演示一次真实 provider 驱动的审批暂停/恢复闭环：管理员消息进入 gateway → 调用已配置的 OpenAI-compatible provider 生成动作计划 → provider 返回需要审批的动作时创建审批 → smoke runner 自动批准并恢复执行 → 线程完成 / The current smoke flow demonstrates a real-provider-backed approval pause/resume loop: an admin message enters through the gateway → the configured OpenAI-compatible provider produces an action plan → a pending approval is created when the provider returns an approval-required action → the smoke runner auto-approves and resumes it → the thread completes
- 线程和审批会写入 SQLite，未完成线程会按来源用户复用 / Threads and approvals are stored in SQLite, and unfinished threads are reused for the same source user

## 快速开始 / Quick Start

### 1) 安装依赖 / Install dependencies

```bash
pnpm install
```

如果本地 `pnpm` 不可用，也可以先用 `npm install` 作为替代。

If `pnpm` is not available locally, you can use `npm install` as a fallback.

### 2) 运行测试 / Run tests

```bash
pnpm test
```

### 3) 运行类型检查 / Run typecheck

```bash
pnpm typecheck
```

### 4) 运行 smoke MVP / Run the smoke MVP

先准备环境变量，然后执行：

Set the environment variables first, then run:

```bash
pnpm start:mvp
```

如果本地没有可用的 `pnpm`，也可以用：

If `pnpm` is not available locally, you can also use:

```bash
npm run start:mvp
```

这个命令当前会：

This command currently does the following:

- 构建 TypeScript 输出到 `dist/` / Build the TypeScript output into `dist/`
- 加载环境变量并初始化应用 / Load environment variables and bootstrap the app
- 初始化 SQLite 数据库并自动应用 migration / Initialize the SQLite database and apply migrations automatically
- 通过专用 smoke runner 发送一条固定的可信管理员消息到 gateway / Send one fixed trusted-admin message through the gateway via the dedicated smoke runner
- 调用已配置的 OpenAI-compatible provider 生成回复与动作计划 / Call the configured OpenAI-compatible provider for the reply and action plan
- 当 provider 返回需要审批的动作时创建审批，并按本次运行新产生的审批 ID 识别该审批 / Create an approval when the provider returns an approval-required action, then detect the approval created by this run by ID diff
- 自动恢复该审批并打印审批 ID 与最终线程状态 / Automatically resume that approval and print the approval ID and final thread status
- 在缺少配置、provider 不可达、或未产生新审批时以非零状态退出 / Exit non-zero when config is missing, the provider is unreachable, or no new approval is created

### 5) 使用真实 provider / Use a real provider

`start:mvp` 现在默认走真实 provider 路径，你只需要提供可访问的 OpenAI-compatible 配置即可。

`start:mvp` now uses the real provider path by default, so you only need to supply reachable OpenAI-compatible settings.

运行前请确认：

Before running, make sure that:

- `LLM_BASE_URL` 指向可访问的 OpenAI-compatible API base URL / `LLM_BASE_URL` points to a reachable OpenAI-compatible API base URL
- 默认 provider 路径会向 `LLM_BASE_URL + /chat/completions` 发送 `POST` 请求 / The default provider path sends a `POST` request to `LLM_BASE_URL + /chat/completions`
- 响应体需要提供 `choices[0].message.content` / The response body must provide `choices[0].message.content`
- 当 `content` 是 JSON 时，运行时会尝试按 `{ reply, actions }` 解析它 / When `content` is JSON, the runtime attempts to parse it as `{ reply, actions }`

要触发当前 smoke MVP 的审批断言，provider 返回内容需要兼容下面的形态：

To trigger the current smoke MVP approval assertion, the provider response content needs to match a shape like:

```json
{"reply":"Need approval","actions":[{"tool":"shell.exec","input":{"command":"pwd"}}]}
```

如果 provider 只返回纯文本，运行时仍会把它当作回复处理，但可能不会创建审批，当前 smoke 断言也会失败并返回非零退出码。

If the provider only returns plain text, the runtime still treats it as a reply, but it may not create an approval and the current smoke assertion fails with a non-zero exit code.

## 环境变量 / Environment Variables

当前代码中的必填环境变量如下：

The current required environment variables in code are:

| Variable | Example | Description |
| --- | --- | --- |
| `ADMIN_USER_ID` | `wxid_admin` | 允许发送控制消息的管理员 WeChat 用户 ID / Trusted admin WeChat user ID |
| `WORKSPACE_ROOT` | `/workspace` | 文件读写与命令执行允许访问的工作区根目录 / Allowed workspace root for file and shell operations |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible API base URL used by the default `start:mvp` provider path / OpenAI-compatible API base URL used by the default `start:mvp` provider path |
| `LLM_MODEL` | `qwen2.5-coder` | 要调用的模型名 / Model name to use |
| `LLM_API_KEY` | `sk-test-123` | 可选的 API Key；某些兼容服务可留空 / Optional API key; may be empty for some compatible services |
| `LLM_SUPPORTS_IMAGE_INPUT` | `false` | 可选，是否支持图像输入；未设置时默认关闭 / Optional image-input capability flag; defaults to disabled when omitted |
| `DATABASE_PATH` | `./data/wechat-claw.db` | SQLite 数据库路径 / SQLite database path |

示例：

Example:

```bash
export ADMIN_USER_ID=wxid_admin
export WORKSPACE_ROOT=/workspace
export LLM_BASE_URL=http://localhost:11434/v1
export LLM_MODEL=qwen2.5-coder
export LLM_API_KEY=
export LLM_SUPPORTS_IMAGE_INPUT=false
export DATABASE_PATH=./data/wechat-claw.db
```

## 常用命令 / Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm start:mvp
```

`start:mvp` 当前会在一次命令里演示“真实 provider 规划 -> 审批请求 -> 自动批准 -> 恢复执行”的 smoke 流程。

`start:mvp` currently demonstrates a single-command smoke flow driven by a real OpenAI-compatible provider: planning -> request approval -> auto-approve -> resume execution.

等价的 npm 方式：

Equivalent npm commands:

```bash
npm install
npx vitest run
npx tsc --noEmit
npm run start:mvp
```

## 项目结构 / Project Structure

```text
src/
  agent/      LLM provider abstraction, planning, runtime
  app/        application composition and bootstrap-related code
  approval/   approval policies and engine
  shared/     shared config and schemas
  store/      SQLite access, migrations, repositories
  tasks/      thread routing, task service, state transitions
  tools/      tool registry and concrete tool runners
  tui/        local terminal UI models and widgets
  wechat/     WeChat gateway and session abstractions

docs/
  plans/      MVP design and implementation planning docs

tests/
  ...         unit tests across app, store, tools, TUI, and task flows
```

## MVP 能力与当前限制 / MVP Capabilities & Current Limits

目标 MVP 的设计方向包括：

The target MVP is designed to support:

- 通过 WeChat 接收管理员请求 / Receive admin requests through WeChat
- 用 LLM 规划动作或直接回复 / Use an LLM to plan actions or answer directly
- 执行受限工具：web、fs、shell、vision、wechat reply / Execute a limited tool surface: web, fs, shell, vision, and WeChat reply
- 通过 TUI 展示线程、日志、审批项和结果 / Show threads, logs, approvals, and outcomes in the TUI
- 对高风险操作执行本地审批 / Require local approval for risky actions

当前根仓库的限制：

Current root-repo limitations:

- `start:mvp` 依赖可访问的 OpenAI-compatible endpoint，以及能返回兼容 `choices[0].message.content` 形态且能触发审批动作的响应 / `start:mvp` depends on a reachable OpenAI-compatible endpoint and a response shape compatible with `choices[0].message.content` that also triggers an approval-required action
- README 当前以测试与类型检查为主，而不是以完整运行流程为主 / This README still focuses on tests and typecheck rather than a fully supported runtime flow.
- 项目仍处于 MVP 收敛阶段，部分能力仍以设计文档和渐进实现为准 / The project is still converging on the MVP, so some behavior is defined by design docs and incremental implementation work.

## Roadmap / Next Steps

后续方向包括：

Planned next steps include:

- 补齐更完整的本地启动与组合入口 / Complete a fuller local startup and composition path
- 完善审批恢复、线程持久化与状态投影 / Improve approval resumption, thread persistence, and state projection
- 丰富 TUI 交互与可观测性 / Expand TUI interaction and observability
- 增强 provider 能力适配与错误处理 / Improve provider capability handling and error reporting
- 在 MVP 稳定后扩展浏览器与桌面自动化能力 / Expand toward browser and desktop automation after MVP stabilization

## 相关设计文档 / Related Docs

- `docs/plans/README.md`
- `docs/plans/archive/2026-03-24-wechat-agent-mvp-design.md`
- `docs/plans/archive/2026-03-24-wechat-agent-mvp.md`

当前没有未完成计划；已完成计划已归档到 `docs/plans/archive/`。

There are currently no incomplete plans. Completed plans are archived in `docs/plans/archive/`.
