import type {TransactionSql} from 'postgres';import {z} from 'zod';
import {requireRole} from './auth';import {hasSameOrigin} from './request-origin';import {fail} from './http';import {zodIssues,contentHash,type QuestionSet} from './question-schema';
export class WorksheetError extends Error{constructor(public code:string,message:string,public status=422){super(message);}}
export async function parentMutation(request:Request){let session;try{session=await requireRole('parent');}catch{throw new WorksheetError('UNAUTHORIZED','Parent sign-in required.',401);}if(!hasSameOrigin(request))throw new WorksheetError('FORBIDDEN','Invalid origin.',403);return session.parentId!;}
export function worksheetError(error:unknown){if(error instanceof WorksheetError)return fail(error.code,error.message,error.status);if(error instanceof z.ZodError)return fail('VALIDATION','Check the highlighted fields before continuing.',422,undefined,{issues:zodIssues(error)});if(error instanceof SyntaxError)return fail('INVALID_JSON','Send a valid worksheet request.',400);if(error instanceof Error&&error.message==='PAYLOAD_TOO_LARGE')return fail('TOO_LARGE','This worksheet is too large to save.',413);return fail('SAVE_FAILED','Could not save your worksheet. Your changes are still on this page; please try again.',500);}
export const learnerIdsSchema=z.array(z.string().uuid()).min(1,'Choose at least one student.').max(100).refine(ids=>new Set(ids).size===ids.length,'Choose each student only once.');
export async function validateLearners(tx:TransactionSql,ids:string[]){const students=await tx`SELECT id FROM students WHERE id IN ${tx(ids)} AND active=true FOR SHARE`;if(students.length!==ids.length)throw new WorksheetError('STUDENT_UNAVAILABLE','One of the selected students is no longer active. Refresh the student list.');}
export async function createAssignment(tx:TransactionSql,parentId:string,title:string,versions:string[],students:string[],key:string,hash:string){
 await tx`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
 const [prior]=await tx`SELECT id,creation_hash FROM assignments WHERE creation_key=${key}`;
 if(prior){if(prior.creation_hash!==hash)throw new WorksheetError('REQUEST_CONFLICT','This request was already used for different content. Reload before trying again.',409);return String(prior.id);}
 if(versions.length!==10||new Set(versions).size!==10)throw new WorksheetError('TEN_QUESTIONS_REQUIRED','Choose exactly 10 different questions.');
 await validateLearners(tx,students);
 const [assignment]=await tx`INSERT INTO assignments(title,state,max_attempts,created_by,creation_key,creation_hash) VALUES(${title},'draft',3,${parentId},${key},${hash}) RETURNING id`;
 for(let i=0;i<10;i++)await tx`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${assignment.id},${versions[i]},${i})`;
 for(const studentId of students)await tx`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${assignment.id},${studentId})`;
 await tx`UPDATE assignments SET state='assigned' WHERE id=${assignment.id}`;
 await tx`INSERT INTO audit_events(actor_role,actor_parent_id,action,entity_type,entity_id,metadata) VALUES('parent',${parentId},'worksheet_assigned','assignment',${assignment.id},${tx.json({questions:10,students:students.length})})`;
 return String(assignment.id);
}
export async function saveManualQuestions(tx:TransactionSql,parentId:string,set:QuestionSet){
 const [row]=await tx`INSERT INTO question_sets(external_set_id,title,description,grade,subject_code,locale,origin,source_metadata,alignment_status,created_by) VALUES(${set.setId},${set.title},${set.description||null},${set.grade},${set.subject},${set.locale},'manual',${tx.json(set.source)},${set.curriculum.alignmentStatus},${parentId}) RETURNING id`;
 const versions:string[]=[];
 for(const q of set.questions){const [question]=await tx`INSERT INTO questions(set_id,external_id,state,type,grade,subject_code,difficulty,content_hash) VALUES(${row.id},${q.externalId},'published',${q.type},${q.grade},${q.subject},${q.difficulty},${contentHash(q)}) RETURNING id`;
 const [version]=await tx`INSERT INTO question_versions(question_id,version,prompt,options,answer_key,grading_policy,parent_explanation,student_translation,assets,tags,metadata,approved_by,approved_at) VALUES(${question.id},1,${tx.json(q.prompt)},${tx.json(q.options)},${tx.json(q.answer)},${tx.json(q.grading)},${tx.json(q.parentExplanation)},${tx.json(q.studentTranslation??{})},${tx.json(q.assets)},${q.tags},${tx.json(JSON.parse(JSON.stringify(q.metadata)))},${parentId},now()) RETURNING id`;versions.push(String(version.id));}
 return {setId:String(row.id),versions};
}
