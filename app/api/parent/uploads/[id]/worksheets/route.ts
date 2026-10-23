import {randomUUID} from 'node:crypto';import {z} from 'zod';import {sql} from '@/lib/db';import {bodyJson,ok,fail} from '@/lib/http';import {parentMutation,worksheetError,WorksheetError} from '@/lib/worksheet-store';import {GRADES,emptyAuthorDraft} from '@/lib/worksheet-authoring';import {uploadDrafts} from '@/lib/upload-worksheet';import {extractWorksheet} from '@/lib/ai/worksheet-extractor';import {loadUpload} from '@/lib/uploads';import {paperAiEnvironmentReady} from '@/lib/ai/paper-grader';
export const runtime='nodejs';export const maxDuration=180;
const bodySchema=z.object({grade:z.enum(GRADES),subject:z.enum(['math','reading','writing','science','social_studies']),mode:z.enum(['ai','manual'])}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 let claim:string|undefined,uploadId:string|undefined;
 try{
  const parentId=await parentMutation(request);uploadId=z.string().uuid().parse((await params).id);const id=uploadId;
  const body=bodySchema.parse(await bodyJson(request,5000));
  const [upload]=await sql`SELECT * FROM uploads WHERE id=${id}`;if(!upload)throw new WorksheetError('NOT_FOUND','Upload not found.',404);
  const existing=await sql`SELECT id,payload->>'title' AS title FROM worksheet_drafts WHERE upload_id=${id} ORDER BY source_order`;if(existing.length){const [job]=await sql`SELECT warnings FROM upload_extractions WHERE upload_id=${id}`;return ok({drafts:existing,warnings:job?.warnings??[],reused:true});}
  if(body.mode==='ai'){
   const [family]=await sql`SELECT value FROM app_settings WHERE key='family'`;
   if(!paperAiEnvironmentReady()||!(family?.value as {externalAiOptIn?:boolean})?.externalAiOptIn)throw new WorksheetError('AI_DISABLED','Enable external AI in your server settings and configure OPENAI_API_KEY, or choose manual transcription.');
  }
  const key=randomUUID();
  const cached=await sql.begin(async tx=>{
   await tx`SELECT id FROM uploads WHERE id=${id} FOR UPDATE`;
   const prior=await tx`SELECT id,payload->>'title' AS title FROM worksheet_drafts WHERE upload_id=${id} ORDER BY source_order`;if(prior.length)return prior;
   const [job]=await tx`SELECT * FROM upload_extractions WHERE upload_id=${id}`;
   if(job?.state==='processing'&&Date.now()-new Date(job.started_at).getTime()<300000)throw new WorksheetError('EXTRACTION_BUSY','This upload is already being read. Wait a moment, then refresh this page.',409);
   const reserve=body.mode==='ai'?.1:0;
   if(reserve){await tx`SELECT pg_advisory_xact_lock(hashtext('shared-ai-budget'))`;const budget=Number(process.env.AI_MONTHLY_BUDGET_USD||10);const [usage]=await tx`SELECT (SELECT coalesce(sum(reserved_cost_usd),0) FROM paper_runs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM upload_extractions WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM worksheet_generation_items WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_images WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_photo_imports WHERE updated_at>=date_trunc('month',now())) AS amount`;if(!Number.isFinite(budget)||Number(usage.amount)+reserve>budget)throw new WorksheetError('BUDGET_LIMIT','The AI allowance has been reached. Choose manual transcription or update the allowance.',429);}
   await tx`INSERT INTO upload_extractions(upload_id,state,request_key,reserved_cost_usd) VALUES(${id},'processing',${key},${reserve}) ON CONFLICT(upload_id) DO UPDATE SET state='processing',request_key=${key},started_at=now(),updated_at=now(),error_code=NULL,reserved_cost_usd=upload_extractions.reserved_cost_usd+${reserve}`;
   await tx`UPDATE uploads SET status='reading' WHERE id=${id}`;return null;
  });if(cached){const [job]=await sql`SELECT warnings FROM upload_extractions WHERE upload_id=${id}`;return ok({drafts:cached,warnings:job?.warnings??[],reused:true});}claim=key;
  let drafts,warnings:string[]=[],inputTokens=0,outputTokens=0;
  if(body.mode==='manual'){const draft=emptyAuthorDraft();draft.title=String(upload.original_filename).slice(0,200);draft.grade=body.grade;draft.subject=body.subject;drafts=[draft];warnings=['Copy the questions and answer keys from the original into all 10 slots before assigning.'];}
  else{
   const read=await extractWorksheet(await loadUpload(String(upload.private_storage_key)),String(upload.mime_type),body.grade,body.subject);drafts=uploadDrafts(read.extraction,body.grade,body.subject);warnings=read.extraction.warnings;inputTokens=read.inputTokens;outputTokens=read.outputTokens;
   if(read.extraction.questions.length%10)warnings.push(`Read ${read.extraction.questions.length} questions. The final worksheet has ${10-read.extraction.questions.length%10} empty slots: fill them before assigning. No extra questions were invented.`);
  }
  const result=await sql.begin(async tx=>{
   const [job]=await tx`SELECT request_key FROM upload_extractions WHERE upload_id=${id} FOR UPDATE`;if(job?.request_key!==key)throw new WorksheetError('STALE_EXTRACTION','A newer read is running. Refresh to see its result.',409);
   const rows=[];for(let i=0;i<drafts.length;i++){const [row]=await tx`INSERT INTO worksheet_drafts(created_by,creation_key,payload,upload_id,source_order) VALUES(${parentId},${`upload:${id}:${i}`},${tx.json(drafts[i])},${id},${i}) RETURNING id,payload->>'title' AS title`;rows.push(row);}
   await tx`UPDATE upload_extractions SET state='ready',warnings=${tx.json(warnings)},input_tokens=${inputTokens},output_tokens=${outputTokens},updated_at=now() WHERE upload_id=${id}`;
   await tx`UPDATE uploads SET status='drafts_ready' WHERE id=${id}`;return rows;
  });return ok({drafts:result,warnings,reused:false},201);
 }catch(error){
  if(claim&&uploadId){await sql`UPDATE upload_extractions SET state='failed',error_code=${error instanceof Error?error.message:'FAILED'},updated_at=now() WHERE upload_id=${uploadId} AND request_key=${claim} AND state='processing'`;await sql`UPDATE uploads SET status='uploaded' WHERE id=${uploadId} AND status='reading' AND EXISTS(SELECT 1 FROM upload_extractions WHERE upload_id=${uploadId} AND request_key=${claim} AND state='failed')`;}
  if(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name))return fail('AI_TIMEOUT','Reading took too long. Your file is safe. Try again or transcribe it manually.',422);
  if(error instanceof Error&&['AI_KEY_INVALID','AI_BILLING_LIMIT','AI_RATE_LIMIT','AI_PROVIDER_FAILED','AI_RESPONSE_INCOMPLETE','AI_EXTRACTION_INVALID','IMAGE_CONVERSION_FAILED','PDF_UNREADABLE','PDF_TOO_MANY_PAGES'].includes(error.message))return fail(error.message,error.message==='PDF_TOO_MANY_PAGES'?'Split this PDF into files of at most 20 pages.':error.message==='PDF_UNREADABLE'?'This PDF could not be read. Use an unencrypted PDF or upload photos of its pages.':error.message==='IMAGE_CONVERSION_FAILED'?'This image could not be decoded. Export it as JPEG/PNG, or transcribe it manually.':'AI could not finish reading this worksheet. Your original file is safe. Try again or use manual transcription.',422);
  return worksheetError(error);
 }
}
