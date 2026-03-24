export type AgentAction = {
  tool: string;
  input: unknown;
};

export type AgentPlan = {
  reply: string;
  actions: AgentAction[];
};

export type AgentProvider = {
  plan(input: { threadId: string; prompt: string }): Promise<AgentPlan>;
};
