import type { ShellExec, ShellExecOutput } from "./shell/runner.js";

export type ToolAction = {
  tool: string;
  input: unknown;
};

export type ToolResult = {
  ok: boolean;
  output: ShellExecOutput;
};

export function createToolRegistry(deps: { shellExec: ShellExec }) {
  return {
    async run(action: ToolAction): Promise<ToolResult> {
      if (action.tool === "shell.exec") {
        const output = await deps.shellExec(action.input as Parameters<ShellExec>[0]);
        return { ok: output.exitCode === 0, output };
      }

      throw new Error(`Unsupported tool: ${action.tool}`);
    },
  };
}
