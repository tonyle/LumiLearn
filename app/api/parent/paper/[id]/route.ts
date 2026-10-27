import { refreshWorksheetCompletion } from "@/lib/worksheet-completion";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { bodyJson,fail,ok } from "@/lib/http";
import { paperContext } from "@/lib/paper-store";
import type { PrivatePaperResult } from "@/lib/paper";
const schema=z.object({results:z.array(z.object({questionId:z.string().uuid(),status:z.enum(["correct","incorrect","needs_review"])}).strict()).min(1).max(10)}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const session=await requireRole("parent"),id=z.string().uuid().parse((await params).id),body=schema.parse(await bodyJson(request));
    const [page]=await sql`SELECT p.*,s.student_id,s.assignment_id FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE p.id=${id}`;
    if(!page)return fail("NOT_FOUND","Page not found.",404);
    const context=await paperContext(page.student_id as string,page.assignment_id as string,Number(page.page_index));
    if(body.results.length!==context.questions.length||new Set(body.results.map(r=>r.questionId)).size!==body.results.length||body.results.some(r=>!context.questions.some(q=>q.id===r.questionId)))return fail("VALIDATION","Grade every question on this page exactly once.",422);
    await sql.begin(async tx=>{
      await tx`SELECT 1 FROM study_clocks WHERE assignment_id=${page.assignment_id} AND student_id=${page.student_id} FOR UPDATE`;
      const [current]=await tx`SELECT * FROM paper_pages WHERE id=${id} FOR UPDATE`;
      if(current.status==="processing")throw Error("PAGE_BUSY");
      const previous=current.results as PrivatePaperResult[];
      const results=body.results.map(r=>({...previous.find(p=>p.questionId===r.questionId),...r,points:r.status==="correct"?10:r.status==="incorrect"?0:null,reason:"Parent confirmed grade.",confidence:r.status==="needs_review"?0:1}));
      await tx`UPDATE paper_pages SET results=${tx.json(results)},status=${results.some(r=>r.status==="needs_review")?"needs_review":"graded"},revision=revision+1,updated_at=now() WHERE id=${id}`;
      await refreshWorksheetCompletion(tx,String(page.submission_id));
      await tx`INSERT INTO audit_events(actor_role,actor_parent_id,action,entity_type,entity_id,metadata) VALUES('parent',${session.parentId},'paper_grade_override','paper_page',${id},${tx.json({results:body.results})})`;
    });return ok({saved:true});
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return fail("FORBIDDEN","Parent sign-in required.",403);if(error instanceof Error&&error.message==="PAGE_BUSY")return fail("PAGE_BUSY","Wait until grading finishes before changing marks.",409);return fail("REVIEW_FAILED","Could not save grades. Refresh the page and try again.",422);}
}
