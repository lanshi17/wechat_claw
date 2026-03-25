import type { AgentProvider, OpenAiCompatibleProviderConfig } from "./base.js";

export function createOpenAiProvider(config: OpenAiCompatibleProviderConfig, provider: AgentProvider): AgentProvider {
  return {
    ...provider,
    config,
  };
}
