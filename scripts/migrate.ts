import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

async function main(){const url=process.env.DATABASE_URL;if(!url)throw new Error("DATABASE_URL is required");const db=postgres(url,{max:1});await db`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;const migrations=["0001_canonical_baseline.sql",...(await readdir(resolve("database/migrations")).catch(()=>[])).filter(n=>/^\d+.*\.sql$/.test(n)).sort()];for(const name of [...new Set(migrations)]){const prior=await db`SELECT 1 FROM schema_migrations WHERE name=${name}`;if(prior.length)continue;const file=name==="0001_canonical_baseline.sql"?resolve("database/schema.sql"):resolve("database/migrations",name);const source=await readFile(file,"utf8");await db.unsafe(source);await db`INSERT INTO schema_migrations(name) VALUES(${name})`;console.log(`Applied ${name}`)}await db.end()}
main().catch(error=>{console.error(error);process.exit(1)});
