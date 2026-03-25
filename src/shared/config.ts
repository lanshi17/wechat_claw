import { envSchema } from "./schema.js";

export function loadConfig(env: Record<string, string | undefined>) {
  const parsed = envSchema.parse(env);

  return {
    adminUserId: parsed.ADMIN_USER_ID,
    workspaceRoot: parsed.WORKSPACE_ROOT,
    databasePath: parsed.DATABASE_PATH,
    llm: {
      apiStyle: "openai-compatible" as const,
      baseUrl: parsed.LLM_BASE_URL,
      model: parsed.LLM_MODEL,
      apiKey: parsed.LLM_API_KEY,
      supportsImageInput: parsed.LLM_SUPPORTS_IMAGE_INPUT === "true",
    },
  };
}
