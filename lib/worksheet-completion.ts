import type { TransactionSql } from 'postgres';
import type { PrivatePaperResult } from './paper';
export const WORKSHEET_GRADING_LIMIT = 2;
export function worksheetCompleted(total: number, results: Pick<PrivatePaperResult, 'status'>[], attempts: number) {
  return results.length === total && total > 0 && (attempts >= WORKSHEET_GRADING_LIMIT || results.every(r => r.status === 'correct'));
}
// Caller holds the learner's study-clock lock before any page locks.
export async function refreshWorksheetCompletion(tx: TransactionSql, submissionId: string) {
  const [submission] = await tx`SELECT * FROM submissions WHERE id=${submissionId} FOR UPDATE`;
  const [total] = await tx`SELECT count(*)::int count FROM assignment_questions WHERE assignment_id=${submission.assignment_id}`;
  const pages = await tx`SELECT id,results,status FROM paper_pages WHERE submission_id=${submissionId}`;
  const runs = await tx`SELECT r.page_id FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id WHERE p.submission_id=${submissionId} AND r.state='succeeded' ORDER BY r.completed_at,r.id`;
  const currentRuns=runs.slice(Number(submission.grading_attempt_offset));
  const complete = submission.status === 'completed' || worksheetPagesCompleted(Number(total.count),pages.map(p=>({results:p.results as PrivatePaperResult[],attempts:currentRuns.filter(r=>r.page_id===p.id).length})));
  await tx`UPDATE submissions SET status=${complete ? 'completed' : pages.some(p => p.status === 'needs_review') ? 'needs_review' : 'in_progress'},completed_at=${complete ? submission.completed_at ?? new Date() : null},last_saved_at=now() WHERE id=${submissionId}`;
}
export async function assertWorksheetOpen(tx: TransactionSql, studentId: string, assignmentId: string) {
  const [membership]=await tx`SELECT student_id FROM assignment_students WHERE assignment_id=${assignmentId} AND student_id=${studentId} AND unassigned_at IS NULL`;
  if(!membership)throw Error('FORBIDDEN');
  const [submission] = await tx`SELECT status FROM submissions WHERE student_id=${studentId} AND assignment_id=${assignmentId}`;
  if (submission?.status === 'completed') throw Error('WORKSHEET_COMPLETED');
}

export function worksheetPagesCompleted(total:number,pages:{results:Pick<PrivatePaperResult,'status'>[];attempts:number}[]){
 return total>0&&pages.reduce((n,p)=>n+p.results.length,0)===total&&pages.every(p=>worksheetCompleted(p.results.length,p.results,p.attempts));
}
