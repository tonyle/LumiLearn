import {z} from 'zod';import {sql} from '@/lib/db';import {bodyJson,ok} from '@/lib/http';import {contentHash} from '@/lib/question-schema';import {parentMutation,worksheetError,WorksheetError,learnerIdsSchema,createAssignment} from '@/lib/worksheet-store';
export async function POST(request:Request){try{const parentId=await parentMutation(request);const body=z.object({title:z.string().trim().min(1).max(200),questionVersionIds:z.array(z.string().uuid()).length(10).refine(ids=>new Set(ids).size===10,'Choose ten different questions.'),studentIds:learnerIdsSchema,creationKey:z.string().regex(/^[a-f0-9]{32}$/)}).strict().parse(await bodyJson(request,30000));
 const assignmentId=await sql.begin(async tx=>{
 const rows=await tx`SELECT qv.id,q.grade,q.subject_code FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE qv.id IN ${tx(body.questionVersionIds)} AND q.state IN ('approved','published') AND qv.version=q.current_version FOR SHARE OF q,qv`;
 if(rows.length!==10)throw new WorksheetError('QUESTIONS_UNAVAILABLE','Some questions changed or are not approved. Reload the library before assigning.',409);
 if(new Set(rows.map(r=>r.grade)).size!==1||new Set(rows.map(r=>r.subject_code)).size!==1)throw new WorksheetError('MIXED_QUESTIONS','Choose ten questions from the same grade and subject.');
 return createAssignment(tx,parentId,body.title,body.questionVersionIds,body.studentIds,`library:${body.creationKey}`,contentHash({title:body.title,questions:body.questionVersionIds,students:[...body.studentIds].sort()}));
 });return ok({assignmentId},201);
 }catch(error){return worksheetError(error);}}
