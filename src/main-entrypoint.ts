import { pathToFileURL } from "node:url";
import { bootstrapApplication } from "./app/bootstrap.js";
import { startTuiRuntime } from "./tui/runtime.js";

type MainEntrypointStream = {
  write(chunk: string): unknown;
};

type MainEntrypointDeps = {
  env: Record<string, string | undefined>;
  stdin: NodeJS.ReadStream;
  stdout: MainEntrypointStream;
  stderr: MainEntrypointStream;
  bootstrapApplication: typeof bootstrapApplication;
  startTuiRuntime: typeof startTuiRuntime;
};

function formatStartupFailure(error: unknown) {
  if (
    typeof error === "object"
    && error !== null
    && "category" in error
    && typeof error.category === "string"
    && "message" in error
    && typeof error.message === "string"
  ) {
    return `Startup failed [${error.category}]: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Startup failed [startup]: ${error.message}`;
  }

  return `Startup failed [startup]: ${String(error)}`;
}

export async function runMainEntrypoint(deps: Partial<MainEntrypointDeps> = {}) {
  const env = deps.env ?? process.env;
  const stdin = deps.stdin ?? process.stdin;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const runBootstrap = deps.bootstrapApplication ?? bootstrapApplication;
  const runTuiRuntime = deps.startTuiRuntime ?? startTuiRuntime;

  try {
    const runtime = await runBootstrap({ env });
    await runtime.start();

    runTuiRuntime(
      {
        app: runtime.app,
        taskService: runtime.taskService,
      },
      {
        stdin,
        stdout,
      },
    );

    return 0;
  } catch (error) {
    stderr.write(`${formatStartupFailure(error)}\n`);
    return 1;
  }
}

export async function main() {
  process.exitCode = await runMainEntrypoint();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
