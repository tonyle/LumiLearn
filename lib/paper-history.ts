import {sql} from './db';
import type {PaperQuestion,PaperResult} from './paper';
type SubmittedRow={id:string;page_id:string;state:string;results:unknown;created_at:Date;duration_ms:number|string|null;has_snapshot:boolean;page_index:number;student_id:string;assignment_id:string;title:string;assignment_state:string;nickname:string};
export async function submittedPaper(runId:string,studentId?:string){
 const [row]=await sql<SubmittedRow[]>`SELECT r.id,r.page_id,r.state,r.results,r.created_at,r.duration_ms,r.snapshot_png IS NOT NULL AS has_snapshot,p.page_index,s.student_id,s.assignment_id,a.title,a.state AS assignment_state,st.nickname FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id JOIN assignments a ON a.id=s.assignment_id JOIN students st ON st.id=s.student_id WHERE r.id=${runId} AND (${studentId??null}::uuid IS NULL OR s.student_id=${studentId??null}::uuid)`;
 if(!row)return null;
 const questions=await sql`SELECT qv.id,q.type,qv.prompt,qv.options FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${row.assignment_id} ORDER BY aq.sort_order LIMIT 10 OFFSET ${Number(row.page_index)*10}`;
 const results=(Array.isArray(row.results)?row.results:[]).map((r:PaperResult)=>({questionId:r.questionId,status:r.status,points:r.points}));
 return {...row,questions:questions as unknown as PaperQuestion[],results};
}
