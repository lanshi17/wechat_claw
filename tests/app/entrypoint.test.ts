import { describe, expect, it, vi } from "vitest";
import { createDefaultEntrypoint } from "../../src/app/entrypoint.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("createDefaultEntrypoint", () => {
  it("builds a runnable app and gateway from env", () => {
    const entry = createDefaultEntrypoint({
      env: {
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "qwen2.5-coder",
        LLM_API_KEY: "",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: ":memory:",
      },
    });

    expect(entry.app).toBeDefined();
    expect(entry.gateway).toBeDefined();
  });

  it("wires the gateway with the trusted admin boundary", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "ok",
                actions: [],
              }),
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const entry = createDefaultEntrypoint({
      env: {
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "qwen2.5-coder",
        LLM_API_KEY: "",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: ":memory:",
      },
    });

    try {
      await entry.gateway.handleInbound({
        fromUserId: "wxid_guest",
        text: "run tests",
        contextToken: "ctx-guest",
      });

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("builds an app and gateway that can support approval-required smoke flows", () => {
    const entry = createDefaultEntrypoint({
      env: {
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "qwen2.5-coder",
        LLM_API_KEY: "",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: ":memory:",
      },
    });

    expect(entry.app).toBeDefined();
    expect(entry.gateway).toBeDefined();
    expect(entry.taskService).toBeDefined();
  });

  it("wires smoke composition to SQLite-backed repositories", () => {
    const entry = createDefaultEntrypoint({
      env: {
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "qwen2.5-coder",
        LLM_API_KEY: "",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: ":memory:",
      },
    });

    entry.setCurrentMessage({
      fromUserId: "wxid_user",
      text: "test message",
    });

    const result = entry.taskService.receiveMessage({
      fromUserId: "wxid_user",
      text: "test message",
    });

    expect(result.threadId).toBeDefined();

    const thread = entry.taskService.getThread(result.threadId);
    expect(thread).toBeDefined();
    expect(thread?.fromUserId).toBe("wxid_user");
    expect(thread?.status).toBe("queued");
  });

  it("persists approval requests to SQLite", () => {
    const entry = createDefaultEntrypoint({
      env: {
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "http://localhost:11434/v1",
        LLM_MODEL: "qwen2.5-coder",
        LLM_API_KEY: "",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: ":memory:",
      },
    });

    entry.setCurrentMessage({
      fromUserId: "wxid_user",
      text: "test message",
    });

    const { threadId } = entry.taskService.receiveMessage({
      fromUserId: "wxid_user",
      text: "test message",
    });

    const { approvalId } = entry.taskService.createApprovalRequest(threadId, {
      tool: "shell.exec",
      input: { command: "echo test" },
    }, "Execute shell command?");

    expect(approvalId).toBeDefined();

    const approval = entry.taskService.getPendingApproval(approvalId);
    expect(approval).toBeDefined();
    expect(approval?.status).toBe("pending");
    expect(approval?.action.tool).toBe("shell.exec");

    entry.taskService.markApproved(approvalId);
    const approvedApproval = entry.taskService.getPendingApproval(approvalId);
    expect(approvedApproval?.status).toBe("approved");
  });

  it("builds smoke composition around the real http provider", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "Needs approval.",
                actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
              }),
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const entry = createDefaultEntrypoint({
        env: {
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "http://localhost:11434/v1",
          LLM_MODEL: "qwen2.5-coder",
          LLM_API_KEY: "",
          LLM_SUPPORTS_IMAGE_INPUT: "false",
          DATABASE_PATH: ":memory:",
        },
      });

      entry.setCurrentMessage({
        fromUserId: "wxid_admin",
        text: "run pwd",
      });

      await entry.app.handleAdminMessage({
        fromUserId: "wxid_admin",
        text: "run pwd",
        contextToken: "ctx-real-provider",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:11434/v1/chat/completions",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses configured DATABASE_PATH for persistent sqlite state", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-claw-entrypoint-"));
    const dbPath = join(tempDir, "entrypoint.db");

    try {
      const writer = createDefaultEntrypoint({
        env: {
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "http://localhost:11434/v1",
          LLM_MODEL: "qwen2.5-coder",
          LLM_API_KEY: "",
          LLM_SUPPORTS_IMAGE_INPUT: "false",
          DATABASE_PATH: dbPath,
        },
      });

      const { threadId } = writer.taskService.receiveMessage({
        fromUserId: "wxid_user",
        text: "persist this",
      });

      writer.taskService.markWaitingApproval(threadId);

      const reader = createDefaultEntrypoint({
        env: {
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "http://localhost:11434/v1",
          LLM_MODEL: "qwen2.5-coder",
          LLM_API_KEY: "",
          LLM_SUPPORTS_IMAGE_INPUT: "false",
          DATABASE_PATH: dbPath,
        },
      });

      const persisted = reader.taskService.getThread(threadId);
      expect(persisted).toBeDefined();
      expect(persisted?.status).toBe("waiting_approval");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reuses a persisted waiting_approval thread after recreating the entrypoint", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "wechat-claw-entrypoint-"));
    const dbPath = join(tempDir, "entrypoint.db");

    try {
      const writer = createDefaultEntrypoint({
        env: {
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "http://localhost:11434/v1",
          LLM_MODEL: "qwen2.5-coder",
          LLM_API_KEY: "",
          LLM_SUPPORTS_IMAGE_INPUT: "false",
          DATABASE_PATH: dbPath,
        },
      });

      const first = writer.taskService.receiveMessage({
        fromUserId: "wxid_user",
        text: "persist this",
      });
      writer.taskService.markWaitingApproval(first.threadId);

      const reader = createDefaultEntrypoint({
        env: {
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "http://localhost:11434/v1",
          LLM_MODEL: "qwen2.5-coder",
          LLM_API_KEY: "",
          LLM_SUPPORTS_IMAGE_INPUT: "false",
          DATABASE_PATH: dbPath,
        },
      });

      const second = reader.taskService.receiveMessage({
        fromUserId: "wxid_user",
        text: "follow up",
      });

      expect(second.threadId).toBe(first.threadId);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
