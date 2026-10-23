import {z} from 'zod';import {sql} from '@/lib/db';import {bodyJson,ok} from '@/lib/http';import {authorDraftSchema,validateAuthorDraft} from '@/lib/worksheet-authoring';import {contentHash} from '@/lib/question-schema';import {parentMutation,worksheetError,WorksheetError,learnerIdsSchema,validateLearners,saveManualQuestions,createAssignment} from '@/lib/worksheet-store';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const parentId=await parentMutation(request);const id=z.string().uuid().parse((await params).id);const body=z.object({baseRevision:z.number().int().positive(),studentIds:learnerIdsSchema,reviewedSource:z.boolean().optional()}).strict().parse(await bodyJson(request,20000));
 const data=await sql.begin(async tx=>{
 const [row]=await tx`SELECT * FROM worksheet_drafts WHERE id=${id} FOR UPDATE`;if(!row)throw new WorksheetError('NOT_FOUND','Worksheet not found.',404);
 if(row.assignment_id){const enrolled=await tx`SELECT student_id FROM assignment_students WHERE assignment_id=${row.assignment_id}`;if(body.studentIds.some(id=>!enrolled.some(s=>s.student_id===id)))throw new WorksheetError('ALREADY_ASSIGNED','This worksheet was already assigned. Use Assign students in Assignments to add more learners.',409);return {assignmentId:String(row.assignment_id),questionSetId:String(row.question_set_id)};}
 if(row.upload_id&&body.reviewedSource!==true)throw new WorksheetError('REVIEW_REQUIRED','Check every question and answer key against the original before assigning.');
 if(row.published_at)throw new WorksheetError('ALREADY_ASSIGNED','This worksheet was already assigned.',409);
 if(row.revision!==body.baseRevision)throw new WorksheetError('REVISION_CONFLICT','This draft changed in another tab. Reopen it before assigning.',409);
 const draft=authorDraftSchema.parse(row.payload),checked=validateAuthorDraft(draft,`manual-${id}`);if(!checked.success)throw checked.error;
 await validateLearners(tx,body.studentIds);
 const saved=await saveManualQuestions(tx,parentId,checked.data);
 const assignmentId=await createAssignment(tx,parentId,checked.data.title,saved.versions,body.studentIds,`manual:${id}`,contentHash({worksheet:id,revision:row.revision,students:[...body.studentIds].sort()}));
 await tx`UPDATE worksheet_drafts SET assignment_id=${assignmentId},question_set_id=${saved.setId},published_at=now(),updated_at=now() WHERE id=${id}`;
 return {assignmentId,questionSetId:saved.setId};
 });return ok(data,201);
 }catch(error){return worksheetError(error);}}
