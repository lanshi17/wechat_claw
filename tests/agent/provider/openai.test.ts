import { describe, expect, it, vi } from "vitest";
import { createOpenAiProvider } from "../../../src/agent/provider/openai.js";

const baseConfig = {
  apiStyle: "openai-compatible" as const,
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5-coder",
  apiKey: "secret",
  supportsImageInput: false,
};

describe("createOpenAiProvider", () => {
  it("calls the configured /chat/completions endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "hello from provider",
            },
          },
        ],
      }),
    });

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await provider.plan({ threadId: "t-1", prompt: "say hello" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("includes Authorization header only when api key is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    });

    const withKey = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });
    await withKey.plan({ threadId: "t-1", prompt: "with key" });

    const withKeyOptions = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(withKeyOptions?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer secret",
      }),
    );

    const withoutKey = createOpenAiProvider({ ...baseConfig, apiKey: "" }, { fetch: fetchMock as typeof fetch });
    await withoutKey.plan({ threadId: "t-2", prompt: "without key" });

    const withoutKeyOptions = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(withoutKeyOptions?.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
      }),
    );
    expect(withoutKeyOptions?.headers).not.toEqual(
      expect.objectContaining({
        Authorization: expect.any(String),
      }),
    );
  });

  it("maps plain text content to a reply-only plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "plain reply" } }],
      }),
    });

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).resolves.toEqual({
      reply: "plain reply",
      actions: [],
    });
  });

  it("maps strict JSON content to an AgentPlan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "Need approval",
                actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
              }),
            },
          },
        ],
      }),
    });

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await expect(provider.plan({ threadId: "t-1", prompt: "run pwd" })).resolves.toEqual({
      reply: "Need approval",
      actions: [{ tool: "shell.exec", input: { command: "pwd" } }],
    });
  });

  it("throws on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).rejects.toThrow(/401/);
  });

  it("throws on malformed JSON planning payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"reply":1}' } }],
      }),
    });

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).rejects.toThrow(/parse/i);
  });

  it("throws when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));

    const provider = createOpenAiProvider(baseConfig, { fetch: fetchMock as typeof fetch });

    await expect(provider.plan({ threadId: "t-1", prompt: "hello" })).rejects.toThrow(/network|request/i);
  });
});
