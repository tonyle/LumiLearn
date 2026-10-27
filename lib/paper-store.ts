import { readClock } from "./study-clock-store";
import { sql } from "./db";
import type { GradingQuestion } from "./paper-grading";
import { QUESTIONS_PER_PAGE, safePaperFeedback, type PaperDraft, type PrivatePaperResult } from "./paper";
export async function paperContext(studentId: string, assignmentId: string, pageIndex: number,readOnly=false) {
  const [assignment] = await sql`SELECT a.id,a.title FROM assignments a JOIN assignment_students ast ON ast.assignment_id=a.id WHERE a.id=${assignmentId} AND ast.student_id=${studentId} AND (a.state='assigned' OR ${readOnly} AND a.state='closed')`;
  if (!assignment) throw new Error("FORBIDDEN");
  const rows = await sql`SELECT qv.id,q.type,qv.prompt,qv.options,qv.answer_key,qv.grading_policy,aq.sort_order FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${assignmentId} ORDER BY aq.sort_order LIMIT ${QUESTIONS_PER_PAGE} OFFSET ${pageIndex * QUESTIONS_PER_PAGE}`;
  if (!rows.length) throw new Error("PAGE_NOT_FOUND");
  const questions = rows.map((row, index) => ({ ...row, number: pageIndex * QUESTIONS_PER_PAGE + index + 1 })) as unknown as GradingQuestion[];
  return { assignment, questions };
}
export function cleanDraft(draft: PaperDraft, previous: PaperDraft, results: PrivatePaperResult[], questions: GradingQuestion[]) {
  if (Object.keys(draft).some(id => !questions.some(q => q.id === id))) throw new Error("INVALID_QUESTION");
  const merged = { ...draft };
  for (const result of results) if (result.status === "correct") merged[result.questionId] = previous[result.questionId] ?? {strokes:[],text:""};
  return merged;
}
export async function readPaper(studentId: string, assignmentId: string, pageIndex: number, count: number) {
  const [progress] = await sql`SELECT s.status,greatest(0,(SELECT count(*) FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id WHERE p.submission_id=s.id AND r.state='succeeded')-s.grading_attempt_offset)::int attempts FROM submissions s WHERE s.student_id=${studentId} AND s.assignment_id=${assignmentId}`;
  const completion = {completed:progress?.status==='completed',gradingAttempts:Number(progress?.attempts??0)};
  const [page] = await sql`SELECT p.* FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${assignmentId} AND s.student_id=${studentId} AND p.page_index=${pageIndex}`;
  if (!page) return { ...completion, revision: 0, draft: {}, feedback: null };
  if (page.status === "processing") {
    const stale = await sql`UPDATE paper_runs SET state='failed',error_code='AI_TIMEOUT',completed_at=now() WHERE page_id=${page.id} AND state='processing' AND created_at<now()-interval '3 minutes' RETURNING id`;
    if (stale.length) { await sql`UPDATE paper_pages SET status='failed' WHERE id=${page.id} AND status='processing'`; page.status="failed"; }
  }
  const results = page.results as PrivatePaperResult[];
  return { ...completion, clock:await readClock(studentId,assignmentId),revision: page.revision as number, draft: page.draft as PaperDraft, feedback: page.status === "draft" && !results.length ? null : safePaperFeedback(page.status as string, results, count) };
}
