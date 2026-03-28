import { describe, expect, it } from "vitest";
import { createDefaultEntrypoint } from "../../src/app/entrypoint.js";

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
});
