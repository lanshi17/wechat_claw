import type { ShellExec, ShellExecOutput } from "./shell/runner.js";
import type { WebSearch, WebSearchOutput } from "./web/runner.js";

export type ToolAction = {
  tool: string;
  input: unknown;
};

export type ToolResult =
  | {
      ok: boolean;
      tool: "shell.exec";
      output: ShellExecOutput;
    }
  | {
      ok: boolean;
      tool: "web.search";
      output: WebSearchOutput;
    };

export function createToolRegistry(deps: { shellExec: ShellExec; webSearch?: WebSearch }) {
  return {
    async run(action: ToolAction): Promise<ToolResult> {
      if (action.tool === "shell.exec") {
        const output = await deps.shellExec(action.input as Parameters<ShellExec>[0]);
        return { ok: output.exitCode === 0, tool: "shell.exec", output };
      }

      if (action.tool === "web.search") {
        if (!deps.webSearch) {
          throw new Error("Web search not configured");
        }
        const output = await deps.webSearch(action.input as Parameters<WebSearch>[0]);
        return { ok: true, tool: "web.search", output };
      }

      throw new Error(`Unsupported tool: ${action.tool}`);
    },
  };
}
