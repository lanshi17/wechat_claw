import { createDefaultEntrypoint } from "./entrypoint.js";

export function createBootstrapConfig(input: { workspaceRoot: string }) {
  return {
    platform: "linux" as const,
    approvalMode: "mixed" as const,
    workspaceRoot: input.workspaceRoot,
  };
}

export async function bootstrapApplication(input: { env: Record<string, string | undefined> }) {
  const config = createBootstrapConfig({ workspaceRoot: input.env.WORKSPACE_ROOT ?? "/" });
  const entrypoint = createDefaultEntrypoint({ env: input.env });

  return {
    app: entrypoint.app,
    gateway: entrypoint.gateway,
    config,
    taskService: entrypoint.taskService,
    setCurrentMessage: entrypoint.setCurrentMessage,
  };
}
