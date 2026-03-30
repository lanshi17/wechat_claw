import { createOpenAiProvider } from "./openai.js";
import type { AgentProvider, OpenAiCompatibleProviderConfig } from "./base.js";
import type { OpenAiCompatibleTransport } from "./openai.js";

export function createOllamaProvider(
  config: OpenAiCompatibleProviderConfig,
  transport?: OpenAiCompatibleTransport,
): AgentProvider {
  return createOpenAiProvider(config, transport);
}
