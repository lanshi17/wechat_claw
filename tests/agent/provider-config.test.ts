import { describe, expect, it, vi } from "vitest";
import { createOpenAiProvider } from "../../src/agent/provider/openai.js";

const config = {
  apiStyle: "openai-compatible" as const,
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5-coder",
  apiKey: undefined,
  supportsImageInput: false,
};

describe("createOpenAiProvider", () => {
  it("accepts normalized openai-compatible config and returns a provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "planning for hello" } }],
      }),
    });

    const provider = createOpenAiProvider(config, { fetch: fetchMock as typeof fetch });

    const result = await provider.plan({ threadId: "t1", prompt: "hello" });

    expect(result.reply).toContain("planning for hello");
  });

  it("preserves config on the provider for runtime wiring", () => {
    const provider = createOpenAiProvider(config, { fetch: vi.fn() as unknown as typeof fetch });

    expect(provider.config).toEqual(config);
  });
});
