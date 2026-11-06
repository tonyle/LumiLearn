import {reviewBackHref} from '@/lib/paper-review-list';
import { readClock } from "@/lib/study-clock-store";
import { formatStudyTime } from "@/lib/study-clock";
import { requireRole } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import {ReopenWorksheet} from "@/components/reopen-worksheet";
import type {GradingQuestion} from "@/lib/paper-grading";
import { PaperReview } from "@/components/paper-review";
import type { PaperDraft, PrivatePaperResult } from "@/lib/paper";
export default async function Review({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){
  await requireRole("parent");
  const backHref=reviewBackHref((await searchParams).returnTo);const {id}=await params;const [page]=await sql`SELECT p.*,s.student_id,s.assignment_id,st.nickname,st.active student_active,s.status submission_status,s.grading_attempt_offset,a.state assignment_state,a.title,EXISTS(SELECT 1 FROM assignment_students ast WHERE ast.assignment_id=a.id AND ast.student_id=s.student_id AND ast.unassigned_at IS NULL) assigned FROM paper_pages p JOIN submissions s ON s.id=p.submission_id JOIN students st ON st.id=s.student_id JOIN assignments a ON a.id=s.assignment_id WHERE p.id=${id}`;
  if(!page)notFound();
  const clock=await readClock(String(page.student_id),String(page.assignment_id));
  const context={questions:await sql`SELECT qv.id,q.type,qv.prompt,qv.options,qv.answer_key,qv.grading_policy FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${page.assignment_id} ORDER BY aq.sort_order LIMIT 10 OFFSET ${Number(page.page_index)*10}` as unknown as GradingQuestion[]};
  const [submitted]=await sql`SELECT (SELECT count(*) FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id WHERE p.submission_id=${page.submission_id} AND r.state='succeeded')>${page.grading_attempt_offset} any_results,EXISTS(SELECT 1 FROM paper_pages p WHERE p.submission_id=${page.submission_id} AND p.status='processing') busy`;
  const canReopen=page.assignment_state==='assigned'&&page.assigned&&page.student_active&&!submitted.busy&&(page.submission_status==='completed'||submitted.any_results);
  const [snapshot]=await sql`SELECT r.id,r.page_id FROM paper_runs r WHERE r.snapshot_png IS NOT NULL AND (r.page_id=${id} OR r.page_id IN (SELECT oldp.id FROM assignments a JOIN submissions olds ON olds.assignment_id=a.source_assignment_id AND olds.student_id=${page.student_id} JOIN paper_pages oldp ON oldp.submission_id=olds.id AND oldp.page_index=a.lesson_number-1 WHERE a.id=${page.assignment_id})) ORDER BY (r.page_id=${id}) DESC,r.created_at DESC LIMIT 1`;
  const results=page.results as PrivatePaperResult[],draft=page.draft as PaperDraft;
  const reopened=page.status==='draft'&&Number(page.grading_attempt_offset)>0&&!results.length;
  const questions=context.questions.map((q,index)=>{const result=results.find(r=>r.questionId===q.id);return{id:q.id,number:Number(page.page_index)*10+index+1,prompt:q.prompt.text,answer:JSON.stringify(q.answer_key,null,2),transcription:result?.transcription||draft[q.id]?.text||"",reason:result?.reason||"",status:result?.status??"needs_review" as const};});
  return <div className="stack"><Link href={backHref} className="muted">← Worksheet review</Link><header><h1>{page.nickname as string} · Page {Number(page.page_index)+1}</h1><p>{page.title as string}</p>{clock?.started&&<span className="pill">Study time {formatStudyTime(clock.elapsedMs)}</span>}{canReopen&&<ReopenWorksheet assignmentId={String(page.assignment_id)} studentId={String(page.student_id)} nickname={String(page.nickname)} triggerLabel="Reopen for student"/>}</header>{reopened&&<p className="notice success">Reopened for the student. The image below is the previous submission; wait for a new submission before grading again.</p>}<div className="split"><section className="card">{snapshot?<Image src={`/api/parent/paper/${snapshot.page_id}/image?v=${snapshot.id}`} alt="Submitted paper with original handwriting" width={1000} height={1800} unoptimized style={{width:"100%",height:"auto"}}/>:<p>No submitted snapshot yet. The learner has saved a draft.</p>}</section><PaperReview pageId={id} questions={questions} processing={page.status==="processing"||reopened}/></div></div>;
}
