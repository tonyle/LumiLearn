import {isDeepStrictEqual} from 'node:util';import {z} from 'zod';
import {sql} from '@/lib/db';import {requireRole} from '@/lib/auth';import {hasSameOrigin} from '@/lib/request-origin';import {bodyJson,ok,fail} from '@/lib/http';import {paperDraftSchema,type PaperDraft,type PrivatePaperResult} from '@/lib/paper';import {paperContext,cleanDraft} from '@/lib/paper-store';import {changeClock} from '@/lib/study-clock-store';
const schema=z.object({pageIndex:z.number().int().min(0).max(19),baseRevision:z.number().int().nonnegative(),draft:paperDraftSchema}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const session=await requireRole('student');if(!hasSameOrigin(request))return fail('FORBIDDEN','Invalid origin.',403);
 const assignmentId=z.string().uuid().parse((await params).id),studentId=session.studentId!,body=schema.parse(await bodyJson(request,3_000_000));const context=await paperContext(studentId,assignmentId,body.pageIndex);
 const result=await sql.begin(async tx=>{
  const current=await changeClock(tx,studentId,assignmentId,'read');
  await tx`SELECT pg_advisory_xact_lock(hashtext(${`${studentId}:${assignmentId}:${body.pageIndex}`}))`;
  const [submission]=await tx`INSERT INTO submissions(assignment_id,student_id) VALUES(${assignmentId},${studentId}) ON CONFLICT(assignment_id,student_id) DO UPDATE SET last_saved_at=submissions.last_saved_at RETURNING id`;
  await tx`INSERT INTO paper_pages(submission_id,page_index) VALUES(${submission.id},${body.pageIndex}) ON CONFLICT DO NOTHING`;
  const [page]=await tx`SELECT * FROM paper_pages WHERE submission_id=${submission.id} AND page_index=${body.pageIndex} FOR UPDATE`;
  const draft=cleanDraft(body.draft,page.draft as PaperDraft,page.results as PrivatePaperResult[],context.questions),unchanged=isDeepStrictEqual(draft,page.draft);
  if(!unchanged&&page.status==='processing')throw Error('PAGE_BUSY');
  if(!unchanged&&page.revision!==body.baseRevision)throw Error('REVISION_CONFLICT');
  if(!unchanged)await tx`UPDATE paper_pages SET draft=${tx.json(draft)},revision=revision+1,updated_at=now() WHERE id=${page.id}`;
  await tx`UPDATE submissions SET last_saved_at=now() WHERE id=${submission.id}`;
  const clock=current.state==='submitted'?current:await changeClock(tx,studentId,assignmentId,'pause');
  return {revision:Number(page.revision)+(unchanged?0:1),clock};
 });return ok(result);
 }catch(error){const code=error instanceof Error?error.message:'FAILED';if(code==='UNAUTHORIZED'||code==='FORBIDDEN')return fail('FORBIDDEN','This worksheet is not available to this learner.',403);if(code==='REVISION_CONFLICT')return fail(code,'This worksheet changed in another tab. Your writing is still here. Resolve the other tab before exiting.',409);if(code==='PAGE_BUSY')return fail(code,'This page is being graded. Please wait, then try Exit again.',409);if(error instanceof z.ZodError||code==='INVALID_QUESTION')return fail('VALIDATION','Your worksheet could not be saved. Your writing is still here.',422);return fail('EXIT_FAILED','Could not save and exit. Your writing is still here; check your connection and try Exit again.',500);}
}
