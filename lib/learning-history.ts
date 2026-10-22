import {sql} from '@/lib/db';
export const learningTimezone='America/Chicago';
export function validDay(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:learningTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export async function learningHistory(studentId:string,day:string){
 return sql`SELECT r.id,p.id page_id,r.created_at,a.id assignment_id,a.title,p.page_index,r.state,r.results,r.duration_ms FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE s.student_id=${studentId} AND (r.created_at AT TIME ZONE ${learningTimezone})::date=${day}::date ORDER BY r.created_at DESC`;
}
export async function activityDays(studentId:string){return sql`SELECT (r.created_at AT TIME ZONE ${learningTimezone})::date::text AS "day",count(*)::int count FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id WHERE s.student_id=${studentId} AND r.created_at>now()-interval '30 days' GROUP BY 1 ORDER BY 1 DESC`;}
