import { pathToFileURL } from "node:url";
import { bootstrapApplication } from "./app/bootstrap.js";
import { startTuiRuntime } from "./tui/runtime.js";

type CliStream = {
  write(chunk: string): unknown;
};

type CliRuntime = Awaited<ReturnType<typeof bootstrapApplication>>;

type CliDeps = {
  env: Record<string, string | undefined>;
  stdout: CliStream;
  stderr: CliStream;
  stdin: typeof process.stdin;
  bootstrapApplication: typeof bootstrapApplication;
  startTuiRuntime: typeof startTuiRuntime;
};

function writeLine(stream: CliStream, line: string) {
  stream.write(`${line}\n`);
}

function usage(stream: CliStream) {
  writeLine(stream, "Usage: wechat-claw <message|approve|reject|tui> ...");
  writeLine(stream, "  message <text...>");
  writeLine(stream, "  approve <approvalId>");
  writeLine(stream, "  reject <approvalId> [reason...]");
  writeLine(stream, "  tui");
}

function getThreadStatus(runtime: CliRuntime, approvalId: string) {
  const approval = runtime.taskService.getPendingApproval?.(approvalId);
  if (!approval) {
    return undefined;
  }

  return runtime.taskService.getThread?.(approval.threadId)?.status;
}

export async function runCli(argv: string[], deps: Partial<CliDeps> = {}) {
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const stdin = deps.stdin ?? process.stdin;
  const runBootstrap = deps.bootstrapApplication ?? bootstrapApplication;
  const runTui = deps.startTuiRuntime ?? startTuiRuntime;
  const [command, ...rest] = argv;

  if (!command || !["message", "approve", "reject", "tui"].includes(command)) {
    usage(stderr);
    return 1;
  }

  if (command === "tui" && rest.length > 0) {
    usage(stderr);
    return 1;
  }

  const runtime = await runBootstrap({ env });

  if (command === "tui") {
    runTui(runtime, { stdin, stdout });
    return 0;
  }

  if (command === "message") {
    if (rest.length === 0) {
      usage(stderr);
      return 1;
    }

    const text = rest.join(" ");
    const fromUserId = env.ADMIN_USER_ID ?? "wxid_admin";
    runtime.setCurrentMessage({
      fromUserId,
      text,
    });
    await runtime.app.handleAdminMessage({
      fromUserId,
      text,
      contextToken: "cli-message",
    });
    writeLine(stdout, `Message submitted: ${text}`);
    return 0;
  }

  const approvalId = rest[0];
  if (!approvalId) {
    usage(stderr);
    return 1;
  }

  if (command === "approve") {
    await runtime.app.resumeApproval(approvalId);
    const status = getThreadStatus(runtime, approvalId);
    writeLine(stdout, `Approval ${approvalId} approved.`);
    if (status) {
      writeLine(stdout, `Final thread status: ${status}`);
    }
    return 0;
  }

  const reason = rest.slice(1).join(" ") || undefined;
  await runtime.app.rejectApproval(approvalId, reason);
  const status = getThreadStatus(runtime, approvalId);
  writeLine(stdout, `Approval ${approvalId} rejected.${reason ? ` Reason: ${reason}` : ""}`);
  if (status) {
    writeLine(stdout, `Final thread status: ${status}`);
  }
  return 0;
}

async function main() {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    if (error instanceof Error) {
      console.error("✗ CLI failed:", error.message);
    } else {
      console.error("✗ CLI failed:", String(error));
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
