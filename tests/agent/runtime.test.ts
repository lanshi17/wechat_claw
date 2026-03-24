import { describe, expect, it } from "vitest";
import { createAgentRuntime } from "../../src/agent/runtime.js";

describe("AgentRuntime", () => {
  it("turns a provider tool plan into executable actions", async () => {
    const runtime = createAgentRuntime({
      provider: {
        async plan() {
          return {
            reply: "Searching the web first.",
            actions: [{ tool: "web.search", input: { query: "rustls" } }],
          };
        },
      },
    });

    const result = await runtime.planNext({ threadId: "t1", prompt: "search rustls" });

    expect(result.reply).toContain("Searching");
    expect(result.actions[0]?.tool).toBe("web.search");
  });
});
