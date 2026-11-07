import {randomUUID} from 'node:crypto';
import {sql} from '@/lib/db';
import {ResourceError} from '@/lib/resource-store';
import {translationKey,translationModel,translateBookPassage} from '@/lib/ai/book-translator';
export async function bookTranslation(text:string){
 const model=translationModel(),key=translationKey(text,model),claim=randomUUID();
 const cached=await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext('shared-ai-budget'))`;
  const[prior]=await tx`SELECT * FROM reading_translation_cache WHERE cache_key=${key}`;
  if(prior?.translation)return String(prior.translation);
  if(prior?.claim_id&&Date.now()-new Date(prior.updated_at).getTime()<60000)throw new ResourceError('BUSY','This passage is being translated. Please try again in a moment.',409);
  const[family]=await tx`SELECT value FROM app_settings WHERE key='family'`;
  if(!family?.value?.externalAiOptIn||process.env.AI_ENABLED!=='true'||process.env.EXTERNAL_AI_OPT_IN!=='true'||!process.env.OPENAI_API_KEY)throw new ResourceError('AI_DISABLED','Enable external AI in Settings and configure OPENAI_API_KEY to translate passages.',409);
  const[usage]=await tx`SELECT ((SELECT coalesce(sum(reserved_cost_usd),0) FROM paper_runs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM upload_extractions WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM worksheet_generation_items WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_images WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_photo_imports WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM reading_book_ocr_jobs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM reading_translation_jobs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM reading_book_activity_attempts WHERE created_at>=date_trunc('month',now())))::float8 amount`;
  const budget=Number(process.env.AI_MONTHLY_BUDGET_USD||10);
  if(!Number.isFinite(budget)||Number(usage.amount)+.01>budget)throw new ResourceError('BUDGET_LIMIT','The monthly AI budget has been reached. Update the budget to translate a new passage.',409);
  await tx`INSERT INTO reading_translation_jobs(id) VALUES(${claim})`;
  await tx`INSERT INTO reading_translation_cache(cache_key,claim_id) VALUES(${key},${claim}) ON CONFLICT(cache_key) DO UPDATE SET claim_id=${claim},updated_at=now()`;
  return null;
 });
 if(cached)return {translation:cached};
 try{
  const translation=await translateBookPassage(text,model);
  await sql`UPDATE reading_translation_cache SET translation=${translation},claim_id=null,updated_at=now() WHERE cache_key=${key} AND claim_id=${claim}`;
  return {translation};
 }catch(e){
  await sql`UPDATE reading_translation_cache SET claim_id=null,updated_at=now() WHERE cache_key=${key} AND claim_id=${claim}`;
  if(e instanceof ResourceError)throw e;
  throw new ResourceError('TRANSLATION','Translation is temporarily unavailable. Please try again.',503);
 }
}
