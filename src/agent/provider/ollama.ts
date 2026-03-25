import { createOpenAiProvider } from "./openai.js";
import type { AgentProvider, OpenAiCompatibleProviderConfig } from "./base.js";

export function createOllamaProvider(config: OpenAiCompatibleProviderConfig, provider: AgentProvider): AgentProvider {
  return createOpenAiProvider(config, provider);
}
