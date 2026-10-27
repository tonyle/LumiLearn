import {sql} from './db';
import type {LibraryQuestion,LibraryQuestionPage} from './library-selection';
export const LIBRARY_PAGE_SIZE=20;
export async function parentLibraryQuestions({grade,subject,set='',search='',page=1}:{grade:string;subject:string;set?:string;search?:string;page?:number}):Promise<LibraryQuestionPage>{
 const filter=sql`q.state IN ('published','approved') AND q.grade=${grade} AND q.subject_code=${subject} ${set?sql`AND qs.id::text=${set}`:sql``} ${search?sql`AND strpos(lower(qv.prompt->>'text'),lower(${search}))>0`:sql``}`;
 return sql.begin(async tx=>{
 await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
 const [count]=await tx`SELECT count(*)::int total FROM questions q JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version JOIN question_sets qs ON qs.id=q.set_id WHERE ${filter}`;
 const total=Number(count.total),actualPage=Math.min(page,Math.max(1,Math.ceil(total/LIBRARY_PAGE_SIZE)));
 const rows=await tx`SELECT qv.id version_id,q.external_id,q.type,q.grade,q.subject_code,q.difficulty,qv.prompt,qv.options,qv.answer_key,qv.grading_policy,qv.parent_explanation,qv.student_translation,qs.id set_id,qs.title set_title FROM questions q JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version JOIN question_sets qs ON qs.id=q.set_id WHERE ${filter} ORDER BY qs.created_at DESC,qs.id,q.external_id,q.id LIMIT ${LIBRARY_PAGE_SIZE} OFFSET ${(actualPage-1)*LIBRARY_PAGE_SIZE}`;
 const questions=rows.map(row=>({versionId:row.version_id,externalId:row.external_id,type:row.type,grade:row.grade,subject:row.subject_code,difficulty:row.difficulty,prompt:row.prompt,options:row.options,answer:row.answer_key,grading:row.grading_policy,parentExplanation:row.parent_explanation,...((row.student_translation as {vi?:string})?.vi?{studentTranslation:row.student_translation}:{}),tags:[],standardCodes:[],assets:[],metadata:{},setId:row.set_id,setTitle:row.set_title})) as LibraryQuestion[];
 return {questions,total,page:actualPage,pageSize:LIBRARY_PAGE_SIZE};
 });
}
