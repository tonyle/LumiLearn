import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateQuestionSet, zodIssues } from "../lib/question-schema";

async function main(){const path=process.argv[2];if(!path){console.error("Usage: npm run validate:questions -- path/to/file.json");process.exit(2)}const raw=await readFile(resolve(path),"utf8");const parsed=JSON.parse(raw) as unknown;const result=validateQuestionSet(parsed);if(!result.success){console.error(JSON.stringify(zodIssues(result.error),null,2));process.exit(1)}console.log(`Valid LumiLearn question set: ${result.data.title} (${result.data.questions.length} questions)`)}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
