export type AgentAction = {
  tool: string;
  input: unknown;
};

export type AgentPlan = {
  reply: string;
  actions: AgentAction[];
};

export type AgentPlanInput = {
  threadId: string;
  prompt: string;
};

export type OpenAiCompatibleProviderConfig = {
  apiStyle: "openai-compatible";
  baseUrl: string;
  model: string;
  apiKey?: string;
  supportsImageInput: boolean;
};

export type AgentProvider = {
  config?: OpenAiCompatibleProviderConfig;
  plan(input: AgentPlanInput): Promise<AgentPlan>;
};
