import { describe, expect, it } from "vitest";
import { createRealFsRead, createRealFsWrite } from "../../src/tools/fs/real-runner.js";
import path from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

function setupWorkspace(): string {
  return mkdtempSync(path.join(path.resolve("/tmp"), "wechat-claw-fs-test-"));
}

describe("createRealFsRead", () => {
  it("reads a file within workspace", async () => {
    const ws = setupWorkspace();
    writeFileSync(path.join(ws, "test.txt"), "hello world");
    const runner = createRealFsRead(ws);

    const result = await runner({ path: "test.txt" });
    expect(result.content).toBe("hello world");
    rmSync(ws, { recursive: true, force: true });
  });

  it("reads a file at a relative subpath", async () => {
    const ws = setupWorkspace();
    mkdirSync(path.join(ws, "subdir"), { recursive: true });
    writeFileSync(path.join(ws, "subdir", "nested.txt"), "nested");
    const runner = createRealFsRead(ws);

    const result = await runner({ path: "subdir/nested.txt" });
    expect(result.content).toBe("nested");
    rmSync(ws, { recursive: true, force: true });
  });

  it("rejects paths that escape the workspace via ..", async () => {
    const ws = setupWorkspace();
    const runner = createRealFsRead(ws);

    await expect(runner({ path: "../etc/passwd" })).rejects.toThrow(/outside workspace/);
    rmSync(ws, { recursive: true, force: true });
  });

  it("throws descriptive error for missing file", async () => {
    const ws = setupWorkspace();
    const runner = createRealFsRead(ws);

    await expect(runner({ path: "nonexistent.txt" })).rejects.toThrow(/file not found/);
    rmSync(ws, { recursive: true, force: true });
  });

  it("throws descriptive error for directory", async () => {
    const ws = setupWorkspace();
    mkdirSync(path.join(ws, "mydir"));
    const runner = createRealFsRead(ws);

    await expect(runner({ path: "mydir" })).rejects.toThrow(/is a directory/);
    rmSync(ws, { recursive: true, force: true });
  });
});

describe("createRealFsWrite", () => {
  it("writes a file and creates parent directories", async () => {
    const ws = setupWorkspace();
    const runner = createRealFsWrite(ws);

    const result = await runner({ path: "subdir/output.txt", content: "generated" });
    expect(result.bytesWritten).toBe(9);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(result.path, "utf-8");
    expect(content).toBe("generated");
    rmSync(ws, { recursive: true, force: true });
  });

  it("overwrites an existing file", async () => {
    const ws = setupWorkspace();
    writeFileSync(path.join(ws, "existing.txt"), "old");
    const runner = createRealFsWrite(ws);

    const result = await runner({ path: "existing.txt", content: "new" });
    expect(result.bytesWritten).toBe(3);
    rmSync(ws, { recursive: true, force: true });
  });

  it("rejects paths that escape the workspace", async () => {
    const ws = setupWorkspace();
    const runner = createRealFsWrite(ws);

    await expect(runner({ path: "../etc/cron.d/evil", content: "x" })).rejects.toThrow(/outside workspace/);
    rmSync(ws, { recursive: true, force: true });
  });
});
