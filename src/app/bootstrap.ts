export function createBootstrapConfig(input: { workspaceRoot: string }) {
  return {
    platform: "linux" as const,
    approvalMode: "mixed" as const,
    workspaceRoot: input.workspaceRoot,
  };
}
