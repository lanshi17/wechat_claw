import type { FsRead, FsReadOutput, FsWrite, FsWriteOutput } from "./fs/runner.js";
import type { ShellExec, ShellExecOutput } from "./shell/runner.js";
import type { VisionAnalyze, VisionAnalyzeOutput } from "./vision/runner.js";
import type { WebFetch, WebFetchOutput, WebSearch, WebSearchOutput } from "./web/runner.js";
import type { WechatReply, WechatReplyOutput } from "./wechat/runner.js";

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
      tool: "fs.read";
      output: FsReadOutput;
    }
  | {
      ok: boolean;
      tool: "fs.write";
      output: FsWriteOutput;
    }
  | {
      ok: boolean;
      tool: "web.search";
      output: WebSearchOutput;
    }
  | {
      ok: boolean;
      tool: "web.fetch";
      output: WebFetchOutput;
    }
  | {
      ok: boolean;
      tool: "vision.analyze";
      output: VisionAnalyzeOutput;
    }
  | {
      ok: boolean;
      tool: "wechat.reply";
      output: WechatReplyOutput;
    };

export function createToolRegistry(deps: {
  shellExec: ShellExec;
  fsRead?: FsRead;
  fsWrite?: FsWrite;
  webSearch?: WebSearch;
  webFetch?: WebFetch;
  visionAnalyze?: VisionAnalyze;
  wechatReply?: WechatReply;
}) {
  return {
    async run(action: ToolAction): Promise<ToolResult> {
      if (action.tool === "shell.exec") {
        const output = await deps.shellExec(action.input as Parameters<ShellExec>[0]);
        return { ok: output.exitCode === 0, tool: "shell.exec", output };
      }

      if (action.tool === "fs.read") {
        if (!deps.fsRead) {
          throw new Error("File read not configured");
        }
        const output = await deps.fsRead(action.input as Parameters<FsRead>[0]);
        return { ok: true, tool: "fs.read", output };
      }

      if (action.tool === "fs.write") {
        if (!deps.fsWrite) {
          throw new Error("File write not configured");
        }
        const output = await deps.fsWrite(action.input as Parameters<FsWrite>[0]);
        return { ok: true, tool: "fs.write", output };
      }

      if (action.tool === "web.search") {
        if (!deps.webSearch) {
          throw new Error("Web search not configured");
        }
        const output = await deps.webSearch(action.input as Parameters<WebSearch>[0]);
        return { ok: true, tool: "web.search", output };
      }

      if (action.tool === "web.fetch") {
        if (!deps.webFetch) {
          throw new Error("Web fetch not configured");
        }
        const output = await deps.webFetch(action.input as Parameters<WebFetch>[0]);
        return { ok: true, tool: "web.fetch", output };
      }

      if (action.tool === "vision.analyze") {
        if (!deps.visionAnalyze) {
          throw new Error("Vision analyze not configured");
        }
        const output = await deps.visionAnalyze(action.input as Parameters<VisionAnalyze>[0]);
        return { ok: true, tool: "vision.analyze", output };
      }

      if (action.tool === "wechat.reply") {
        if (!deps.wechatReply) {
          throw new Error("Wechat reply not configured");
        }
        const output = await deps.wechatReply(action.input as Parameters<WechatReply>[0]);
        return { ok: output.delivered, tool: "wechat.reply", output };
      }

      throw new Error(`Unsupported tool: ${action.tool}`);
    },
  };
}
