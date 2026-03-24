import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/shared/config.js";

describe("loadConfig", () => {
  it("loads a text+vision capable provider config", () => {
    const cfg = loadConfig({
      ADMIN_USER_ID: "wxid_admin",
      WORKSPACE_ROOT: "/workspace",
      LLM_PROVIDER: "openai",
      LLM_MODEL: "gpt-5.4",
      DATABASE_PATH: "./data/app.db",
    });

    expect(cfg.adminUserId).toBe("wxid_admin");
    expect(cfg.provider.type).toBe("openai");
    expect(cfg.provider.capabilities.imageInput).toBe(true);
  });
});
