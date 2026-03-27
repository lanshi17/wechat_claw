import { describe, expect, it } from "vitest";
import { createBootstrapConfig, bootstrapApplication } from "../../src/app/bootstrap.js";

describe("createBootstrapConfig", () => {
  it("normalizes the MVP defaults", () => {
    const cfg = createBootstrapConfig({ workspaceRoot: "/tmp/demo" });

    expect(cfg.platform).toBe("linux");
    expect(cfg.workspaceRoot).toBe("/tmp/demo");
    expect(cfg.approvalMode).toBe("mixed");
  });
});

describe("bootstrapApplication", () => {
  it("composes entrypoint with bootstrap config to create startable runtime", async () => {
    const result = await bootstrapApplication({
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

    expect(result).toHaveProperty("app");
    expect(result).toHaveProperty("gateway");
    expect(result).toHaveProperty("config");
    expect(result.config.workspaceRoot).toBe("/workspace");
  });

  it("exposes taskService for approval-resume smoke flows", async () => {
    const result = await bootstrapApplication({
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

    expect(result).toHaveProperty("taskService");
    expect(result.taskService).toHaveProperty("receiveMessage");
    expect(result.taskService).toHaveProperty("getPendingApproval");
  });
});
