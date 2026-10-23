import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sql} from '@/lib/db';
import {vocabSession} from '@/lib/vocab-store';
import {ResourceError,resourceError} from '@/lib/resource-store';
import {ok} from '@/lib/http';
import {prepareWordPhoto,readWordPhoto} from '@/lib/ai/vocab-photo';
export const maxDuration=150;
export async function POST(request:Request){let job:string|undefined;try{
 const session=await vocabSession(request,'parent');
 if(Number(request.headers.get('content-length')||0)>21*1024*1024)throw new ResourceError('PHOTO_SIZE','Keep photos under 20 MB.');
 const form=await request.formData(),key=z.string().uuid().parse(form.get('key')),file=form.get('photo');
 if(!(file instanceof File)||!file.size||file.size>20*1024*1024)throw new ResourceError('PHOTO_SIZE','Choose a photo up to 20 MB.');
 const bytes=Buffer.from(await file.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');
 const photo=await prepareWordPhoto(bytes);
 const cached=await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext('shared-ai-budget'))`;
  const [prior]=await tx`SELECT * FROM vocab_photo_imports WHERE id=${key}`;
  if(prior){if(prior.parent_id!==session.parentId||prior.photo_hash!==hash)throw new ResourceError('CONFLICT','Choose the photo again to start a new import.',409);if(prior.state==='ready')return prior.result;if(prior.state==='processing'&&Date.now()-new Date(prior.updated_at).getTime()<180000)throw new ResourceError('PROCESSING','This photo is still being read. Please wait, then retry.',409);}
  const [family]=await tx`SELECT value FROM app_settings WHERE key='family'`;
  if(!family?.value?.externalAiOptIn||process.env.AI_ENABLED!=='true'||process.env.EXTERNAL_AI_OPT_IN!=='true'||!process.env.OPENAI_API_KEY)throw new ResourceError('AI_DISABLED','Enable external AI in Settings and configure OPENAI_API_KEY to read photos.',409);
  const [usage]=await tx`SELECT ((SELECT coalesce(sum(reserved_cost_usd),0) FROM paper_runs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM upload_extractions WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM worksheet_generation_items WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_images WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_photo_imports WHERE updated_at>=date_trunc('month',now())))::float8 amount`;
  const budget=Number(process.env.AI_MONTHLY_BUDGET_USD||10);if(!Number.isFinite(budget)||Number(usage.amount)+.05>budget)throw new ResourceError('BUDGET_LIMIT','The monthly AI budget has been reached.',409);
  await tx`INSERT INTO vocab_photo_imports(id,parent_id,photo_hash,state) VALUES(${key},${session.parentId},${hash},'processing') ON CONFLICT(id) DO UPDATE SET state='processing',reserved_cost_usd=vocab_photo_imports.reserved_cost_usd+.05,updated_at=now()`;return null;
 });if(cached)return ok(cached);job=key;
 const result=await readWordPhoto(photo);await sql`UPDATE vocab_photo_imports SET state='ready',result=${sql.json(result)},updated_at=now() WHERE id=${key}`;return ok(result);
 }catch(error){if(job)await sql`UPDATE vocab_photo_imports SET state='failed',updated_at=now() WHERE id=${job}`;if(error instanceof ResourceError||error instanceof z.ZodError)return resourceError(error);return resourceError(new ResourceError('PHOTO_IMPORT_FAILED',error instanceof Error?error.message:'Could not read the photo. Please retry.',422));}}
