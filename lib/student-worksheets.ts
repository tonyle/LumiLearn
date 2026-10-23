import {sql} from './db';
import type {StudentSubject} from './student-subjects';
import {WORKSHEET_PAGE_SIZE,type WorksheetFilter} from './student-worksheet-filters';
export {WORKSHEET_PAGE_SIZE,worksheetFilter,worksheetPage,worksheetListHref,worksheetState} from './student-worksheet-filters';
function worksheetQuery(studentId:string){return sql`SELECT a.id,a.title,a.due_at,a.created_at,count(aq.question_version_id)::int question_count,coalesce(min(q.subject_code),'math') subject_code,sub.status FROM assignment_students ast JOIN assignments a ON a.id=ast.assignment_id LEFT JOIN assignment_questions aq ON aq.assignment_id=a.id LEFT JOIN question_versions qv ON qv.id=aq.question_version_id LEFT JOIN questions q ON q.id=qv.question_id LEFT JOIN submissions sub ON sub.assignment_id=a.id AND sub.student_id=ast.student_id WHERE ast.student_id=${studentId} AND a.state='assigned' GROUP BY a.id,sub.status`;}
function statusFilter(status:WorksheetFilter){return status==='all'?sql`true`:status==='completed'?sql`status='completed'`:status==='in_progress'?sql`status IS NOT NULL AND status<>'completed'`:sql`status IS DISTINCT FROM 'completed'`;}
export async function studentWorksheets(studentId:string,subject:StudentSubject,status:WorksheetFilter,requestedPage:number){
 const base=worksheetQuery(studentId),filter=statusFilter(status);
 const counts=await sql`WITH worksheets AS (${base}) SELECT subject_code,count(*)::int total,count(*) FILTER(WHERE status IS DISTINCT FROM 'completed')::int todo,count(*) FILTER(WHERE ${filter})::int visible FROM worksheets GROUP BY subject_code`;
 const total=Number(counts.find(c=>c.subject_code===subject)?.visible??0),pages=Math.max(1,Math.ceil(total/WORKSHEET_PAGE_SIZE)),page=Math.min(Math.max(1,requestedPage),pages);
 const rows=await sql`WITH worksheets AS (${base}) SELECT id,title,question_count,status FROM worksheets WHERE subject_code=${subject} AND (${filter}) ORDER BY CASE WHEN status IS NOT NULL AND status<>'completed' THEN 0 ELSE 1 END,due_at NULLS LAST,created_at DESC,id DESC LIMIT ${WORKSHEET_PAGE_SIZE} OFFSET ${(page-1)*WORKSHEET_PAGE_SIZE}`;
 return {rows,total,pages,page,counts:Object.fromEntries(counts.map(c=>[String(c.subject_code),Number(c.visible)])),todo:counts.reduce((sum,c)=>sum+Number(c.todo),0),completed:counts.reduce((sum,c)=>sum+Number(c.total)-Number(c.todo),0)};
}
