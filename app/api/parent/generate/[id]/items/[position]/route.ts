import {randomUUID} from 'node:crypto';import {z} from 'zod';
import {sql} from '@/lib/db';import {ok,fail} from '@/lib/http';import {parentMutation,worksheetError,WorksheetError} from '@/lib/worksheet-store';import {loadGenerationBatch} from '@/lib/generation-store';import {generationParametersSchema,generationErrorMessage,normalizeQuestion} from '@/lib/worksheet-generation';import {generateWorksheet} from '@/lib/ai/worksheet-generator';import {paperAiEnvironmentReady} from '@/lib/ai/paper-grader';
export const runtime='nodejs';export const maxDuration=180;
export async function POST(request:Request,{params}:{params:Promise<{id:string;position:string}>}){
 let claim:{id:string;position:number;key:string}|undefined;
 try{
 const parentId=await parentMutation(request);const raw=await params;const id=z.string().uuid().parse(raw.id);const position=z.coerce.number().int().min(0).max(9).parse(raw.position);const key=randomUUID();
 const work=await sql.begin(async tx=>{
  const [batch]=await tx`SELECT * FROM worksheet_generation_batches WHERE id=${id} AND created_by=${parentId} FOR UPDATE`;if(!batch)throw new WorksheetError('NOT_FOUND','Generation batch not found.',404);
  const [item]=await tx`SELECT * FROM worksheet_generation_items WHERE batch_id=${id} AND position=${position}`;if(!item)throw new WorksheetError('NOT_FOUND','Worksheet not found.',404);
  if(item.state==='ready'&&item.draft_id)return null;
  if(item.state==='processing'&&Date.now()-new Date(item.started_at).getTime()<180000)throw new WorksheetError('GENERATION_BUSY',generationErrorMessage('GENERATION_BUSY'),409);
  const [family]=await tx`SELECT value FROM app_settings WHERE key='family'`;if(!paperAiEnvironmentReady()||!family?.value?.externalAiOptIn)throw new WorksheetError('AI_DISABLED',generationErrorMessage('AI_DISABLED'));
  await tx`SELECT pg_advisory_xact_lock(hashtext('shared-ai-budget'))`;
  const [usage]=await tx`SELECT (SELECT coalesce(sum(reserved_cost_usd),0) FROM paper_runs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM upload_extractions WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM worksheet_generation_items WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_images WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_photo_imports WHERE updated_at>=date_trunc('month',now())) amount`;
  const budget=Number(process.env.AI_MONTHLY_BUDGET_USD||10);if(!Number.isFinite(budget)||Number(usage.amount)+.1>budget)throw new WorksheetError('BUDGET_LIMIT',generationErrorMessage('BUDGET_LIMIT'),429);
  await tx`UPDATE worksheet_generation_items SET state='processing',request_key=${key},started_at=now(),updated_at=now(),error_code=NULL,reserved_cost_usd=reserved_cost_usd+.1 WHERE batch_id=${id} AND position=${position}`;
  const drafts=await tx`SELECT d.payload FROM worksheet_generation_items i JOIN worksheet_drafts d ON d.id=i.draft_id WHERE i.batch_id=${id}`;
  return {parameters:generationParametersSchema.parse(batch.parameters),previous:drafts.flatMap(d=>(d.payload.questions as {text:string}[]).map(q=>q.text))};
 });
 if(!work)return ok(await loadGenerationBatch(id,parentId));claim={id,position,key};
 const generated=await generateWorksheet(work.parameters,position,work.previous);
 await sql.begin(async tx=>{
  await tx`SELECT id FROM worksheet_generation_batches WHERE id=${id} FOR UPDATE`;
  const [item]=await tx`SELECT request_key FROM worksheet_generation_items WHERE batch_id=${id} AND position=${position} FOR UPDATE`;if(item.request_key!==key)throw new WorksheetError('STALE_GENERATION','A newer generation is running. Refresh to see the result.',409);
  const others=await tx`SELECT d.payload FROM worksheet_generation_items i JOIN worksheet_drafts d ON d.id=i.draft_id WHERE i.batch_id=${id}`;const seen=new Set(others.flatMap(d=>(d.payload.questions as {text:string}[]).map(q=>normalizeQuestion(q.text))));if(generated.draft.questions.some(q=>seen.has(normalizeQuestion(q.text))))throw Error('AI_DUPLICATE_QUESTIONS');
  const [draft]=await tx`INSERT INTO worksheet_drafts(created_by,creation_key,payload) VALUES(${parentId},${`generate:${id}:${position}`},${tx.json(generated.draft)}) RETURNING id`;
  await tx`UPDATE worksheet_generation_items SET state='ready',draft_id=${draft.id},warnings=${tx.json(generated.warnings)},input_tokens=${generated.inputTokens},output_tokens=${generated.outputTokens},updated_at=now() WHERE batch_id=${id} AND position=${position}`;
 });return ok(await loadGenerationBatch(id,parentId),201);
 }catch(error){
 const code=error instanceof WorksheetError?error.code:error instanceof Error&&['AI_KEY_INVALID','AI_BILLING_LIMIT','AI_RATE_LIMIT','AI_PROVIDER_FAILED','AI_RESPONSE_INCOMPLETE','AI_INVALID_QUESTIONS','AI_DUPLICATE_QUESTIONS'].includes(error.message)?error.message:'GENERATION_FAILED';
 if(claim)await sql`UPDATE worksheet_generation_items SET state='failed',error_code=${code},updated_at=now() WHERE batch_id=${claim.id} AND position=${claim.position} AND request_key=${claim.key} AND state='processing'`;
 if(claim&&!(error instanceof WorksheetError))return fail(code,generationErrorMessage(code),422);
 return worksheetError(error);
 }
}
