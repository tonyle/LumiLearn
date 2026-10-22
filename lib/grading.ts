import { z } from "zod";

export type Verdict = "correct" | "incorrect" | "needs_review";
export type AnswerKey =
  | { kind:"option_id"; optionId:string }
  | { kind:"option_ids"; optionIds:string[] }
  | { kind:"number"; value:number; tolerance:number; unit?:string|null }
  | { kind:"text"; accepted:string[]; normalization?:"trim_casefold"|"trim_only"|"exact" }
  | { kind:"ordered_ids"; orderedIds:string[] }
  | { kind:"boolean"; value:boolean }
  | { kind:"rubric"; criteria:unknown[]; sampleAnswer:string };

const responseSchema = z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]), unit: z.string().max(32).optional() });
const normalize = (v:string, mode="trim_casefold") => mode === "exact" ? v : mode === "trim_only" ? v.trim().normalize("NFKC") : v.trim().normalize("NFKC").replace(/\s+/g," ").toLocaleLowerCase("en-US");
function numeric(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const compact = value.trim();
  if (!compact) return null;
  const fraction = compact.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (fraction) { const d=Number(fraction[2]); return d ? Number(fraction[1])/d : null; }
  const n=Number(compact); return Number.isFinite(n) ? n : null;
}
export function gradeDeterministic(key: AnswerKey, raw: unknown): { verdict:Verdict; reason:string } {
  if (key.kind === "rubric") return { verdict:"needs_review", reason:"Open response requires parent or configured AI review." };
  const parsed=responseSchema.safeParse(raw); if (!parsed.success) return { verdict:"incorrect", reason:"Response shape was invalid." };
  const value=parsed.data.value;
  if (key.kind === "option_id") return outcome(typeof value === "string" && value === key.optionId, "Selected option comparison");
  if (key.kind === "option_ids") return outcome(Array.isArray(value) && sameSet(value,key.optionIds), "Selected options comparison");
  if (key.kind === "ordered_ids") return outcome(Array.isArray(value) && value.length===key.orderedIds.length && value.every((v,i)=>v===key.orderedIds[i]), "Ordering comparison");
  if (key.kind === "boolean") return outcome(typeof value === "boolean" && value===key.value, "Boolean comparison");
  if (key.kind === "text") return outcome(typeof value === "string" && key.accepted.some((a)=>normalize(value,key.normalization)===normalize(a,key.normalization)), "Normalized accepted-answer comparison");
  const n=numeric(value as string|number); if (n===null) return outcome(false,"Could not parse numeric response");
  const expectedUnit=(key.unit??"").trim().toLocaleLowerCase(); const received=(parsed.data.unit??"").trim().toLocaleLowerCase();
  if (expectedUnit !== received) return outcome(false,"Units did not match");
  return outcome(Math.abs(n-key.value)<=key.tolerance+Number.EPSILON,"Numeric tolerance comparison");
}
const outcome=(correct:boolean, reason:string)=>({ verdict:(correct?"correct":"incorrect") as Verdict, reason });
const sameSet=(a:string[],b:string[])=>a.length===b.length && [...a].sort().every((v,i)=>v===[...b].sort()[i]);
