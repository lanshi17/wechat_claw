import type {
  AgentAction,
  AgentPlan,
  AgentPlanInput,
  AgentProvider,
  OpenAiCompatibleProviderConfig,
} from "./base.js";

export type OpenAiCompatibleTransport = {
  fetch: typeof fetch;
};

const SYSTEM_PROMPT = [
  "You are a planning assistant for a local automation workflow.",
  "Return plain text for direct replies.",
  "If tool execution is needed, return strict JSON: {\"reply\": string, \"actions\": [{\"tool\": string, \"input\": object}] }.",
].join(" ");

function trimTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAgentAction(value: unknown): value is AgentAction {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.tool === "string" && Object.prototype.hasOwnProperty.call(value, "input");
}

function parseStructuredPlan(content: string): AgentPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse provider json plan: ${message}`);
  }

  if (!isObject(parsed)) {
    throw new Error("failed to parse provider json plan: expected object payload");
  }

  if (typeof parsed.reply !== "string") {
    throw new Error("failed to parse provider json plan: reply must be a string");
  }

  if (!Array.isArray(parsed.actions) || !parsed.actions.every(isAgentAction)) {
    throw new Error("failed to parse provider json plan: actions must be an array of { tool, input }");
  }

  return {
    reply: parsed.reply,
    actions: parsed.actions,
  };
}

function mapCompletionContent(content: string): AgentPlan {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("openai provider returned empty message content");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseStructuredPlan(trimmed);
  }

  return {
    reply: content,
    actions: [],
  };
}

export function createOpenAiProvider(
  config: OpenAiCompatibleProviderConfig,
  transport: OpenAiCompatibleTransport = { fetch },
): AgentProvider {
  return {
    config,
    async plan(input: AgentPlanInput): Promise<AgentPlan> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.apiKey && config.apiKey.trim().length > 0) {
        headers.Authorization = `Bearer ${config.apiKey}`;
      }

      const url = `${trimTrailingSlash(config.baseUrl)}/chat/completions`;
      const requestBody = {
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input.prompt },
        ],
      };

      let response: Response;
      try {
        response = await transport.fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`openai provider request failed: ${message}`);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        const details = errorBody ? `: ${errorBody}` : "";
        throw new Error(`openai provider request failed with status ${response.status}${details}`);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`openai provider returned invalid json: ${message}`);
      }

      if (!isObject(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
        throw new Error("openai provider returned no completion choices");
      }

      const firstChoice = payload.choices[0];
      if (!isObject(firstChoice) || !isObject(firstChoice.message) || typeof firstChoice.message.content !== "string") {
        throw new Error("openai provider returned empty message content");
      }

      return mapCompletionContent(firstChoice.message.content);
    },
  };
}
