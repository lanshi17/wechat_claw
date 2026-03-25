import { describe, expect, it } from "vitest";
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
    const provider = createOpenAiProvider(config, {
      async plan(input) {
        return {
          reply: `planning for ${input.prompt}`,
          actions: [],
        };
      },
    });

    const result = await provider.plan({ threadId: "t1", prompt: "hello" });

    expect(result.reply).toContain("planning for hello");
  });

  it("preserves config on the provider for runtime wiring", () => {
    const provider = createOpenAiProvider(config, {
      async plan() {
        return {
          reply: "ok",
          actions: [],
        };
      },
    });

    expect(provider.config).toEqual(config);
  });
});
