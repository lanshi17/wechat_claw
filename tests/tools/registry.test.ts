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

  it("dispatches fs.read and fs.write with normalized outputs", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
      fsRead: vi.fn().mockResolvedValue({ path: "/workspace/README.md", content: "hello" }),
      fsWrite: vi.fn().mockResolvedValue({ path: "/workspace/out.txt", bytesWritten: 2 }),
    });

    const readResult = await registry.run({ tool: "fs.read", input: { path: "README.md" } });
    const writeResult = await registry.run({ tool: "fs.write", input: { path: "out.txt", content: "hi" } });

    expect(readResult.tool).toBe("fs.read");
    expect(readResult.ok).toBe(true);
    if (readResult.tool !== "fs.read") throw new Error("expected fs.read result");
    expect(readResult.output).toEqual({ path: "/workspace/README.md", content: "hello" });

    expect(writeResult.tool).toBe("fs.write");
    expect(writeResult.ok).toBe(true);
    if (writeResult.tool !== "fs.write") throw new Error("expected fs.write result");
    expect(writeResult.output).toEqual({ path: "/workspace/out.txt", bytesWritten: 2 });
  });

  it("dispatches web.fetch, vision.analyze, and wechat.reply with normalized outputs", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
      webFetch: vi.fn().mockResolvedValue({ url: "https://example.com", text: "hello" }),
      visionAnalyze: vi.fn().mockResolvedValue({ summary: "diagram" }),
      wechatReply: vi.fn().mockResolvedValue({ delivered: true }),
    });

    const fetchResult = await registry.run({ tool: "web.fetch", input: { url: "https://example.com" } });
    const visionResult = await registry.run({ tool: "vision.analyze", input: { imagePath: "diagram.png" } });
    const replyResult = await registry.run({ tool: "wechat.reply", input: { toUserId: "wxid_admin", text: "done" } });

    expect(fetchResult.tool).toBe("web.fetch");
    expect(fetchResult.ok).toBe(true);
    if (fetchResult.tool !== "web.fetch") throw new Error("expected web.fetch result");
    expect(fetchResult.output).toEqual({ url: "https://example.com", text: "hello" });

    expect(visionResult.tool).toBe("vision.analyze");
    expect(visionResult.ok).toBe(true);
    if (visionResult.tool !== "vision.analyze") throw new Error("expected vision.analyze result");
    expect(visionResult.output).toEqual({ summary: "diagram" });

    expect(replyResult.tool).toBe("wechat.reply");
    expect(replyResult.ok).toBe(true);
    if (replyResult.tool !== "wechat.reply") throw new Error("expected wechat.reply result");
    expect(replyResult.output).toEqual({ delivered: true });
  });

  it("throws for unsupported tools", async () => {
    const registry = createToolRegistry({
      shellExec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" }),
    });

    await expect(registry.run({ tool: "unknown.tool", input: {} })).rejects.toThrow(
      "Unsupported tool: unknown.tool",
    );
  });
});
