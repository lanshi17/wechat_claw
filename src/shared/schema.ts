import { z } from "zod";

export const envSchema = z.object({
  ADMIN_USER_ID: z.string().min(1),
  WORKSPACE_ROOT: z.string().min(1),
  LLM_PROVIDER: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  DATABASE_PATH: z.string().min(1),
});

export type EnvConfig = z.infer<typeof envSchema>;
