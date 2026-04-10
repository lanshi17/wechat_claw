import { describe, expect, it } from "vitest";
import { describeConfigError, loadConfig } from "../../src/shared/config.js";

describe("describeConfigError", () => {
  it("summarizes missing required env names in stable order", () => {
    expect(describeConfigError({
      issues: [
        { path: ["ADMIN_USER_ID"] },
        { path: ["DATABASE_PATH"] },
      ],
    } as never)).toContain("Missing required config: ADMIN_USER_ID, DATABASE_PATH");
  });
});

describe("loadConfig", () => {
  describe("OpenAI-compatible environment contract", () => {
    it("requires LLM_BASE_URL", () => {
      expect(() =>
        loadConfig({
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_MODEL: "gpt-4o-mini",
          DATABASE_PATH: "./data/app.db",
        })
      ).toThrow();
    });

    it("requires LLM_MODEL", () => {
      expect(() =>
        loadConfig({
          ADMIN_USER_ID: "wxid_admin",
          WORKSPACE_ROOT: "/workspace",
          LLM_BASE_URL: "https://api.openai.com/v1",
          DATABASE_PATH: "./data/app.db",
        })
      ).toThrow();
    });

    it("accepts optional LLM_API_KEY", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.apiKey).toBeUndefined();
    });

    it("accepts LLM_API_KEY when provided", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        LLM_API_KEY: "sk-test-123",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.apiKey).toBe("sk-test-123");
    });

    it("loads baseUrl and model correctly", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.baseUrl).toBe("https://api.openai.com/v1");
      expect(cfg.llm.model).toBe("gpt-4o-mini");
    });

    it("defaults image capability to false when LLM_SUPPORTS_IMAGE_INPUT not specified", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.supportsImageInput).toBe(false);
    });

    it("respects explicit LLM_SUPPORTS_IMAGE_INPUT=true", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        LLM_SUPPORTS_IMAGE_INPUT: "true",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.supportsImageInput).toBe(true);
    });

    it("respects explicit LLM_SUPPORTS_IMAGE_INPUT=false", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        LLM_SUPPORTS_IMAGE_INPUT: "false",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.llm.supportsImageInput).toBe(false);
    });

    it("preserves other config fields (adminUserId, workspaceRoot, databasePath)", () => {
      const cfg = loadConfig({
        ADMIN_USER_ID: "wxid_admin",
        WORKSPACE_ROOT: "/workspace",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_MODEL: "gpt-4o-mini",
        DATABASE_PATH: "./data/app.db",
      });

      expect(cfg.adminUserId).toBe("wxid_admin");
      expect(cfg.workspaceRoot).toBe("/workspace");
      expect(cfg.databasePath).toBe("./data/app.db");
    });
  });
});
