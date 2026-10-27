import {reviewBackHref} from '@/lib/paper-review-list';
import { readClock } from "@/lib/study-clock-store";
import { formatStudyTime } from "@/lib/study-clock";
import { requireRole } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { paperContext } from "@/lib/paper-store";
import { PaperReview } from "@/components/paper-review";
import type { PaperDraft, PrivatePaperResult } from "@/lib/paper";
export default async function Review({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){
  await requireRole("parent");
  const backHref=reviewBackHref((await searchParams).returnTo);const {id}=await params;const [page]=await sql`SELECT p.*,s.student_id,s.assignment_id,st.nickname,a.title FROM paper_pages p JOIN submissions s ON s.id=p.submission_id JOIN students st ON st.id=s.student_id JOIN assignments a ON a.id=s.assignment_id WHERE p.id=${id}`;
  if(!page)notFound();
  const clock=await readClock(String(page.student_id),String(page.assignment_id));
  const context=await paperContext(page.student_id as string,page.assignment_id as string,Number(page.page_index),true);
  const [snapshot]=await sql`SELECT r.id,r.page_id FROM paper_runs r WHERE r.snapshot_png IS NOT NULL AND (r.page_id=${id} OR r.page_id IN (SELECT oldp.id FROM assignments a JOIN submissions olds ON olds.assignment_id=a.source_assignment_id AND olds.student_id=${page.student_id} JOIN paper_pages oldp ON oldp.submission_id=olds.id AND oldp.page_index=a.lesson_number-1 WHERE a.id=${page.assignment_id})) ORDER BY (r.page_id=${id}) DESC,r.created_at DESC LIMIT 1`;
  const results=page.results as PrivatePaperResult[],draft=page.draft as PaperDraft;
  const questions=context.questions.map((q,index)=>{const result=results.find(r=>r.questionId===q.id);return{id:q.id,number:Number(page.page_index)*10+index+1,prompt:q.prompt.text,answer:JSON.stringify(q.answer_key,null,2),transcription:result?.transcription||draft[q.id]?.text||"",reason:result?.reason||"",status:result?.status??"needs_review" as const};});
  return <div className="stack"><Link href={backHref} className="muted">← Worksheet review</Link><header><h1>{page.nickname as string} · Page {Number(page.page_index)+1}</h1><p>{page.title as string}</p>{clock?.started&&<span className="pill">Study time {formatStudyTime(clock.elapsedMs)}</span>}</header><div className="split"><section className="card">{snapshot?<Image src={`/api/parent/paper/${snapshot.page_id}/image?v=${snapshot.id}`} alt="Submitted paper with original handwriting" width={1000} height={1800} unoptimized style={{width:"100%",height:"auto"}}/>:<p>No submitted snapshot yet. The learner has saved a draft.</p>}</section><PaperReview pageId={id} questions={questions} processing={page.status==="processing"}/></div></div>;
}
