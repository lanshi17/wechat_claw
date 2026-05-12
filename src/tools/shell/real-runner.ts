import { exec as nodeExec, type ExecOptions } from "node:child_process";
import path from "node:path";

type ExecCallback = (error: (Error & { code?: number | string; signal?: string }) | null, stdout: string, stderr: string) => void;
type ExecFn = (command: string, options: ExecOptions, callback: ExecCallback) => void;

export function createRealShellExec(workspaceRoot: string, timeoutMs = 30_000, execFn: ExecFn = nodeExec as unknown as ExecFn) {
  return async function shellExec(input: { command: string }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const resolved = path.resolve(workspaceRoot, input.command);
    if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
      throw new Error(`shell.exec: command path outside workspace root: ${input.command}`);
    }

    const options: ExecOptions = {
      cwd: workspaceRoot,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    };

    return new Promise((resolve) => {
      execFn(input.command, options, (error, stdout, stderr) => {
        const out = String(stdout ?? "");
        const err = String(stderr ?? "");
        if (error) {
          if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
            resolve({ exitCode: 124, stdout: out, stderr: `Command timed out after ${timeoutMs}ms` });
            return;
          }
          resolve({ exitCode: typeof error.code === "number" ? error.code : 1, stdout: out, stderr: err || error.message });
          return;
        }
        resolve({ exitCode: 0, stdout: out, stderr: err });
      });
    });
  };
}
