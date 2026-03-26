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
});
