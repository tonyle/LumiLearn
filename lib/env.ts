import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  AI_ENABLED: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(10),
  EXTERNAL_AI_OPT_IN: z.enum(["true", "false"]).default("false"),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(100).default(20),
  TZ: z.string().default("America/Chicago")
});

export function env() {
  return schema.parse(process.env);
}
