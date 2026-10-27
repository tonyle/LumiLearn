import {PARENT_HISTORY_PAGE_SIZE} from './history-pagination';import {sql} from '@/lib/db';import {HISTORY_PAGE_SIZE} from './student-history-filters';import type {StudentSubject} from './student-subjects';
export const learningTimezone='America/Chicago';
export function validDay(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:learningTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export async function learningHistory(studentId:string,day:string,subject?:StudentSubject){
 return sql`SELECT r.id,p.id page_id,r.created_at,a.id assignment_id,a.title,p.page_index,r.state,r.results,r.duration_ms FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=${studentId} AND (r.created_at AT TIME ZONE ${learningTimezone})::date=${day}::date AND (${!subject} OR EXISTS(SELECT 1 FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=a.id AND q.subject_code=${subject??''})) ORDER BY r.created_at DESC`;
}
export async function activityDays(studentId:string,subject?:StudentSubject){return sql`SELECT (r.created_at AT TIME ZONE ${learningTimezone})::date::text AS "day",count(*)::int count FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id WHERE s.student_id=${studentId} AND r.created_at>now()-interval '30 days' AND (${!subject} OR EXISTS(SELECT 1 FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=s.assignment_id AND q.subject_code=${subject??''})) GROUP BY 1 ORDER BY 1 DESC`;}
export async function studentHistoryPage(studentId:string,day:string,subject:StudentSubject,requestedPage:number){
 const source=sql`FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=${studentId} AND (r.created_at AT TIME ZONE ${learningTimezone})::date=${day}::date AND EXISTS(SELECT 1 FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=a.id AND q.subject_code=${subject})`;
 const [count]=await sql`SELECT count(*)::int total ${source}`;const total=Number(count.total),pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE)),page=Math.min(Math.max(1,requestedPage),pages);
 const rows=await sql`SELECT r.id,r.created_at,a.title,p.page_index,r.state,r.results,r.duration_ms ${source} ORDER BY r.created_at DESC,r.id DESC LIMIT ${HISTORY_PAGE_SIZE} OFFSET ${(page-1)*HISTORY_PAGE_SIZE}`;
 return {rows,total,pages,page};
}

export async function parentHistoryPage(studentId:string,day:string,requestedPage:number,requestedEarlierPage:number){
 const size=PARENT_HISTORY_PAGE_SIZE;
 const source=sql`FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=${studentId} AND (r.created_at AT TIME ZONE ${learningTimezone})::date=${day}::date`;
 const earlierSource=sql`FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE s.student_id=${studentId} AND a.state='closed'`;
 const [[count],[earlierCount]]=await Promise.all([sql`SELECT count(*)::int total ${source}`,sql`SELECT count(*)::int total ${earlierSource}`]);
 const total=Number(count.total),earlierTotal=Number(earlierCount.total),pages=Math.max(1,Math.ceil(total/size)),earlierPages=Math.max(1,Math.ceil(earlierTotal/size)),page=Math.min(Math.max(1,requestedPage),pages),earlierPage=Math.min(Math.max(1,requestedEarlierPage),earlierPages);
 const [rows,earlier]=await Promise.all([sql`SELECT r.id,r.created_at,a.title,p.page_index,r.state,r.results,r.duration_ms ${source} ORDER BY r.created_at DESC,r.id DESC LIMIT ${size} OFFSET ${(page-1)*size}`,sql`SELECT a.id,a.title ${earlierSource} ORDER BY s.started_at DESC,s.id DESC LIMIT ${size} OFFSET ${(earlierPage-1)*size}`]);
 return {rows,total,pages,page,earlier,earlierTotal,earlierPages,earlierPage};
}

export async function earlierStudentHistoryPage(studentId:string,subject:StudentSubject,requestedPage:number){
 const source=sql`FROM assignments a JOIN submissions s ON s.assignment_id=a.id WHERE s.student_id=${studentId} AND a.state='closed' AND EXISTS(SELECT 1 FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=a.id AND q.subject_code=${subject})`;
 const [count]=await sql`SELECT count(*)::int total ${source}`;const total=Number(count.total),pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE)),page=Math.min(Math.max(1,requestedPage),pages);
 const rows=await sql`SELECT a.id,a.title ${source} ORDER BY s.started_at DESC,s.id DESC LIMIT ${HISTORY_PAGE_SIZE} OFFSET ${(page-1)*HISTORY_PAGE_SIZE}`;
 return {rows,total,pages,page};
}
