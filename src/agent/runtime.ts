import { planNextAction } from "./planner.js";
import type { AgentProvider } from "./provider/base.js";

export function createAgentRuntime(deps: { provider: AgentProvider }) {
  return {
    async planNext(input: { threadId: string; prompt: string }) {
      return planNextAction(deps.provider, input);
    },
  };
}
