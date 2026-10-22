import { createHash } from "node:crypto";
export * from "./question-contract";
export function contentHash(value:unknown){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
