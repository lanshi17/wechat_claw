import type { AgentPlan, AgentProvider } from "./provider/base.js";

export async function planNextAction(provider: AgentProvider, input: { threadId: string; prompt: string }): Promise<AgentPlan> {
  return provider.plan(input);
}
