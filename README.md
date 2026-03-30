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

当前根仓库仍处于早期 MVP 开发阶段。

The root repository is still in an early MVP stage.

- 已有基础模块与测试：agent、task service、tool registry、approval engine、store、TUI、WeChat gateway
- 当前仓库已经提供一个最小可运行的 smoke 路径：`start:mvp`
- 这个 smoke 路径现在会演示一次完整的审批暂停/恢复闭环：`消息 -> 真实 provider 规划 -> 生成审批 -> CLI 批准 -> 工具执行 -> 回复`
- 设计文档已经定义了更完整的 MVP 形态，当前实现仍是通往完整版本的中间切片

- Core modules and tests already exist: agent, task service, tool registry, approval engine, store, TUI, and WeChat gateway.
- The repository now exposes a minimal runnable smoke path via `start:mvp`.
- That smoke path now demonstrates a full approval pause/resume loop driven by a real provider: `message -> real provider planning -> approval creation -> CLI approval -> tool execution -> reply`.
- The design docs still describe a fuller MVP target; the current implementation is an intermediate runnable slice rather than the final version.

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

- 加载当前环境配置 / Load the current environment config
- 组装一个最小可运行的 app + gateway / Compose a minimal runnable app + gateway
- 调用真实 OpenAI-compatible `/chat/completions` 端点生成计划结果 / Call a real OpenAI-compatible `/chat/completions` endpoint to produce the plan
- 创建审批请求并打印 approval ID / Create an approval request and print the approval ID
- 模拟一次 CLI 批准并恢复执行 / Simulate a CLI approval and resume execution
- 打印最终线程完成状态 / Print the final thread completion status

如果 `LLM_BASE_URL` 不可达或 API 配置错误，`start:mvp` 会显式失败并打印 provider 错误。

If `LLM_BASE_URL` is unreachable or API config is invalid, `start:mvp` will fail visibly with a provider error.


## 环境变量 / Environment Variables

当前代码中的必填环境变量如下：

The current required environment variables in code are:

| Variable | Example | Description |
| --- | --- | --- |
| `ADMIN_USER_ID` | `wxid_admin` | 允许发送控制消息的管理员 WeChat 用户 ID / Trusted admin WeChat user ID |
| `WORKSPACE_ROOT` | `/workspace` | 文件读写与命令执行允许访问的工作区根目录 / Allowed workspace root for file and shell operations |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible API base URL / OpenAI-compatible API base URL |
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

`start:mvp` 当前会在一次命令里演示“真实 provider 规划 -> 审批请求 -> 批准 -> 恢复执行”的 smoke 流程。

`start:mvp` currently demonstrates a single-command smoke flow driven by a real OpenAI-compatible provider: planning -> request approval -> approve -> resume execution.

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

- 还没有把完整端到端运行路径作为根仓库默认入口稳定暴露出来
- README 当前以测试与类型检查为主，而不是以完整运行流程为主
- 项目仍处于 MVP 收敛阶段，部分能力仍以设计文档和渐进实现为准

- A fully stable end-to-end runtime path is not yet exposed as the default root-repo entrypoint.
- This README focuses on tests and typecheck rather than a fully supported runtime flow.
- The project is still converging on the MVP, so some behavior is defined by design docs and incremental implementation work.

## Roadmap / Next Steps

后续方向包括：

Planned next steps include:

- 补齐更完整的本地启动与组合入口 / Complete a fuller local startup and composition path
- 完善审批恢复、线程持久化与状态投影 / Improve approval resumption, thread persistence, and state projection
- 丰富 TUI 交互与可观测性 / Expand TUI interaction and observability
- 增强 provider 能力适配与错误处理 / Improve provider capability handling and error reporting
- 在 MVP 稳定后扩展浏览器与桌面自动化能力 / Expand toward browser and desktop automation after MVP stabilization

## 相关设计文档 / Related Docs

- `docs/plans/2026-03-24-wechat-agent-mvp-design.md`
- `docs/plans/2026-03-24-wechat-agent-mvp.md`

如果你要继续实现 MVP，建议先阅读上述设计与实现计划文档。

If you want to keep building the MVP, start with the design and implementation plan documents above.
