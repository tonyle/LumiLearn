import {z} from 'zod';
import {sql} from '@/lib/db';
import {bodyJson,ok} from '@/lib/http';
import {parentMutation,worksheetError,WorksheetError} from '@/lib/worksheet-store';
import {generationParametersSchema} from '@/lib/worksheet-generation';
export async function POST(request:Request){try{
 const parentId=await parentMutation(request);
 const body=z.object({creationKey:z.string().regex(/^[a-f0-9]{32}$/),parameters:generationParametersSchema}).strict().parse(await bodyJson(request,10000));
 const id=await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${body.creationKey}))`;
  const [prior]=await tx`SELECT id,created_by,parameters FROM worksheet_generation_batches WHERE creation_key=${body.creationKey}`;
  if(prior){if(prior.created_by!==parentId||JSON.stringify(generationParametersSchema.parse(prior.parameters))!==JSON.stringify(body.parameters))throw new WorksheetError('REQUEST_CONFLICT','This request was already used. Start a new batch.',409);return String(prior.id);}
  const [batch]=await tx`INSERT INTO worksheet_generation_batches(created_by,creation_key,parameters) VALUES(${parentId},${body.creationKey},${tx.json(body.parameters)}) RETURNING id`;
  for(let i=0;i<body.parameters.count;i++)await tx`INSERT INTO worksheet_generation_items(batch_id,position) VALUES(${batch.id},${i})`;
  return String(batch.id);
 });return ok({id},201);
}catch(error){return worksheetError(error);}}
