import {z} from 'zod';import {sql} from '@/lib/db';import {bodyJson,ok} from '@/lib/http';import {parentMutation,worksheetError,WorksheetError} from '@/lib/worksheet-store';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const parentId=await parentMutation(request);const id=z.string().uuid().parse((await params).id);const body=z.object({title:z.string().trim().min(1,'Enter a worksheet title.').max(200),baseTitle:z.string().min(1).max(200)}).strict().parse(await bodyJson(request,5000));
 const data=await sql.begin(async tx=>{
  // Match publication's lock order so renaming and assignment never deadlock.
  await tx`SELECT id FROM worksheet_drafts WHERE assignment_id=${id} FOR UPDATE`;
  const [assignment]=await tx`SELECT id,title FROM assignments WHERE id=${id} FOR UPDATE`;if(!assignment)throw new WorksheetError('NOT_FOUND','Worksheet not found.',404);
  if(assignment.title!==body.baseTitle&&assignment.title!==body.title)throw new WorksheetError('TITLE_CONFLICT','The title changed in another tab. Refresh and try again.',409);
  if(assignment.title!==body.title){
   await tx`UPDATE assignments SET title=${body.title},updated_at=now() WHERE id=${id}`;
   await tx`UPDATE worksheet_drafts SET payload=jsonb_set(payload,'{title}',to_jsonb(${body.title}::text)),revision=revision+1,updated_at=now() WHERE assignment_id=${id}`;
   await tx`INSERT INTO audit_events(actor_role,actor_parent_id,action,entity_type,entity_id,metadata) VALUES('parent',${parentId},'worksheet_renamed','assignment',${id},${tx.json({previousTitle:assignment.title,title:body.title})})`;
  }
  return {id,title:body.title};
 });return ok(data);
 }catch(error){return worksheetError(error);}}
