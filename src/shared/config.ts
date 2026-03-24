import { envSchema } from "./schema.js";

export function loadConfig(env: Record<string, string | undefined>) {
  const parsed = envSchema.parse(env);

  return {
    adminUserId: parsed.ADMIN_USER_ID,
    workspaceRoot: parsed.WORKSPACE_ROOT,
    databasePath: parsed.DATABASE_PATH,
    provider: {
      type: parsed.LLM_PROVIDER,
      model: parsed.LLM_MODEL,
      capabilities: { imageInput: parsed.LLM_PROVIDER === "openai" },
    },
  };
}
