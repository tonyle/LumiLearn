import postgres from "postgres";
import { env } from "@/lib/env";

const globalDb = globalThis as unknown as { lumiSql?: ReturnType<typeof postgres> };

export const sql = globalDb.lumiSql ?? postgres(env().DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: { undefined: null }
});

if (process.env.NODE_ENV !== "production") globalDb.lumiSql = sql;
