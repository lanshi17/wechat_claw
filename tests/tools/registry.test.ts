import { describe, expect, it, vi } from "vitest";
import { createToolRegistry } from "../../src/tools/registry.js";

describe("ToolRegistry", () => {
  it("dispatches an approved shell action and returns a normalized result", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
    });

    const result = await registry.run({ tool: "shell.exec", input: { command: "pwd" } });

    expect(result.ok).toBe(true);
    expect(result.output.exitCode).toBe(0);
  });
});
