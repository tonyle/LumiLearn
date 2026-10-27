import {z} from 'zod';
import {syncRewards} from '@/lib/games';
import {sql} from '@/lib/db';
import {bodyJson,ok} from '@/lib/http';
import {parentMutation,worksheetError,WorksheetError} from '@/lib/worksheet-store';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const parentId=await parentMutation(request),id=z.string().uuid().parse((await params).id);
  const {studentId}=z.object({studentId:z.string().uuid()}).strict().parse(await bodyJson(request,1000));
  await sql.begin(async tx=>{
   const [assigned]=await tx`SELECT a.id FROM assignments a JOIN assignment_students ast ON ast.assignment_id=a.id JOIN students st ON st.id=ast.student_id WHERE a.id=${id} AND ast.student_id=${studentId} AND a.state='assigned' AND st.active=true FOR SHARE OF a,ast,st`;
   if(!assigned)throw new WorksheetError('NOT_FOUND','This active worksheet is not assigned to this student.',404);
   await tx`SELECT 1 FROM study_clocks WHERE assignment_id=${id} AND student_id=${studentId} FOR UPDATE`;
   const [submission]=await tx`SELECT * FROM submissions WHERE assignment_id=${id} AND student_id=${studentId} FOR UPDATE`;
   if(!submission||submission.status!=='completed')throw new WorksheetError('NOT_COMPLETED','Only a completed worksheet can be reopened. Refresh the page.',409);
   const pages=await tx`SELECT id,status FROM paper_pages WHERE submission_id=${submission.id} FOR UPDATE`;
   if(pages.some(p=>p.status==='processing'))throw new WorksheetError('PAGE_BUSY','Wait for grading to finish.',409);
   const [runs]=await tx`SELECT count(*)::int count FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id WHERE p.submission_id=${submission.id} AND r.state='succeeded'`;
   await syncRewards(tx,studentId);
   // Immutable runs (images, marks and durations) remain available in History.
   await tx`UPDATE paper_pages SET draft='{}'::jsonb,results='[]'::jsonb,status='draft',revision=revision+1,updated_at=now() WHERE submission_id=${submission.id}`;
   await tx`UPDATE submissions SET status='in_progress',completed_at=NULL,grading_attempt_offset=${runs.count},last_saved_at=now() WHERE id=${submission.id}`;
   await tx`UPDATE study_clocks SET state='paused',running_since=NULL,lease_until=NULL,updated_at=now() WHERE assignment_id=${id} AND student_id=${studentId}`;
   await tx`INSERT INTO audit_events(actor_role,actor_parent_id,action,entity_type,entity_id,metadata) VALUES('parent',${parentId},'worksheet_reopened','submission',${submission.id},${tx.json({studentId,assignmentId:id,previousAttempts:runs.count})})`;
  });return ok({reopened:true});
 }catch(error){return worksheetError(error);}
}
