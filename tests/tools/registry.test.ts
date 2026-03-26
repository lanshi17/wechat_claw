import { describe, expect, it, vi } from "vitest";
import { createToolRegistry } from "../../src/tools/registry.js";

describe("ToolRegistry", () => {
  it("dispatches an approved shell action and returns a normalized result", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
    });

    const result = await registry.run({ tool: "shell.exec", input: { command: "pwd" } });

    expect(result.ok).toBe(true);
    expect(result.tool).toBe("shell.exec");
    if (result.tool !== "shell.exec") throw new Error("expected shell.exec result");
    expect(result.output.exitCode).toBe(0);
  });

  it("dispatches a web.search action and returns items", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
      webSearch: vi.fn().mockResolvedValue({ items: [{ title: "rustls" }] }),
    });

    const result = await registry.run({ tool: "web.search", input: { query: "rustls" } });

    expect(result.ok).toBe(true);
    expect(result.tool).toBe("web.search");
    if (result.tool !== "web.search") throw new Error("expected web.search result");
    expect(result.output.items).toEqual([{ title: "rustls" }]);
  });
});
