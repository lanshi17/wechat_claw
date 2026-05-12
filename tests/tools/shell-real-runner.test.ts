import { describe, expect, it } from "vitest";
import { createRealShellExec } from "../../src/tools/shell/real-runner.js";
import type { ExecOptions } from "node:child_process";
import path from "node:path";

type ExecCallback = (error: (Error & { code?: number | string; signal?: string }) | null, stdout: string, stderr: string) => void;

function mockExec(exitCode: number, stdout: string, stderr: string) {
  return (_cmd: string, _opts: ExecOptions, cb: ExecCallback) => {
    if (exitCode === 0) {
      cb(null, stdout, stderr);
    } else {
      const err: Error & { code?: number | string; signal?: string } = Object.assign(new Error("command failed"), { code: exitCode });
      cb(err, stdout, stderr);
    }
  };
}

function mockExecTimeout() {
  return (_cmd: string, _opts: ExecOptions, cb: ExecCallback) => {
    const err: Error & { code?: number | string; signal?: string } = Object.assign(new Error("timed out"), {
      code: "ETIMEDOUT" as const,
      signal: "SIGTERM",
    });
    cb(err, "", "");
  };
}

const workspaceRoot = path.resolve("/tmp/test-workspace");

describe("createRealShellExec", () => {
  it("executes a command and returns exit code 0 with stdout", async () => {
    const runner = createRealShellExec(workspaceRoot, 5000, mockExec(0, "hello", ""));
    const result = await runner({ command: "echo hello" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
  });

  it("returns non-zero exit code for failing commands", async () => {
    const runner = createRealShellExec(workspaceRoot, 5000, mockExec(1, "", "error"));
    const result = await runner({ command: "false" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("error");
  });

  it("returns exit code 124 on timeout", async () => {
    const runner = createRealShellExec(workspaceRoot, 100, mockExecTimeout());
    const result = await runner({ command: "sleep 10" });
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timed out");
  });

  it("rejects commands that escape the workspace", async () => {
    const runner = createRealShellExec(workspaceRoot, 5000, mockExec(0, "", ""));
    await expect(runner({ command: "/etc/passwd" })).rejects.toThrow(/outside workspace/);
  });
});
