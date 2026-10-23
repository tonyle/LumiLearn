import {sql} from './db';
import {WorksheetError} from './worksheet-store';
import type {GenerationBatch} from './worksheet-generation';
export async function loadGenerationBatch(id:string,parentId:string):Promise<GenerationBatch>{
 const [batch]=await sql`SELECT id,parameters FROM worksheet_generation_batches WHERE id=${id} AND created_by=${parentId}`;
 if(!batch)throw new WorksheetError('NOT_FOUND','Generation batch not found.',404);
 const items=await sql`SELECT i.position,i.state,i.draft_id,i.warnings,i.error_code,i.started_at,d.payload->>'title' title FROM worksheet_generation_items i LEFT JOIN worksheet_drafts d ON d.id=i.draft_id WHERE i.batch_id=${id} ORDER BY i.position`;
 return {id:String(batch.id),parameters:batch.parameters,items:items.map(i=>({...i,started_at:i.started_at?new Date(i.started_at).toISOString():null}))} as GenerationBatch;
}
