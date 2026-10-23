import { missingPaperQuestions } from "@/lib/paper-completion";
import { changeClock,runningClock } from "@/lib/study-clock-store";
import { z } from "zod";
import sharp from "sharp";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { bodyJson, fail, ok } from "@/lib/http";
import { paperDraftSchema, paperSvg, type PaperDraft, type PrivatePaperResult } from "@/lib/paper";
import { cleanDraft, paperContext, readPaper } from "@/lib/paper-store";
import { gradeTyped, mergePaperResults } from "@/lib/paper-grading";
import { gradePaperImage, paperAiEnvironmentReady } from "@/lib/ai/paper-grader";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 120;
const bodySchema = z.object({ baseRevision: z.number().int().nonnegative(), draft: paperDraftSchema }).strict();
class IncompletePage extends Error { constructor(public missingQuestions:number[]){super("INCOMPLETE_PAGE");} }
type Params = { params: Promise<{ id: string; page: string }> };
async function context(params: Params,readOnly=false) {
  const session = await requireRole("student"), route = await params.params;
  const assignmentId = z.string().uuid().parse(route.id), pageIndex = z.coerce.number().int().min(0).max(19).parse(route.page);
  return { studentId: session.studentId!, assignmentId, pageIndex, ...await paperContext(session.studentId!, assignmentId, pageIndex,readOnly) };
}
function errorResponse(error: unknown) {
  if(error instanceof IncompletePage)return fail("INCOMPLETE_PAGE","Finish every question on this page before submitting.",422,undefined,{missingQuestions:error.missingQuestions});
  const code = error instanceof Error ? error.message : "FAILED";
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return fail("FORBIDDEN", "This page is not available to this learner.", 403);
  if(code==="LESSON_PAUSED")return fail(code,"Resume the timer before writing or submitting.",423);
  if (code === "PAGE_NOT_FOUND") return fail("NOT_FOUND", "Page not found.", 404);
  if (code === "REVISION_CONFLICT") return fail(code, "This page changed in another tab. Your work is still here; reopen the assignment before continuing.", 409);
  if (code === "PAGE_BUSY") return fail(code, "This page is being graded. Please wait.", 409);
  if (code === "BUDGET_LIMIT") return fail(code, "The AI grading allowance has been reached. Your work is saved; ask your parent to review it.", 429);
  if (code === "ALL_CORRECT") return fail(code, "All questions on this page are already correct.", 409);
  if (error instanceof z.ZodError || code === "INVALID_QUESTION") return fail("VALIDATION", "The page could not be saved. Please check its size and answers.", 422);
  return fail("PAGE_FAILED", "Your page could not be processed. Your saved work is kept; please try again.", 500);
}
export async function GET(_: Request, params: Params) {
  try { const c = await context(params,true); return ok(await readPaper(c.studentId, c.assignmentId, c.pageIndex, c.questions.length)); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, params: Params) {
  try {
    const c = await context(params), body = bodySchema.parse(await bodyJson(request, 3_000_000));
    const revision = await sql.begin(async tx => {
      await runningClock(tx,c.studentId,c.assignmentId);
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`${c.studentId}:${c.assignmentId}:${c.pageIndex}`}))`;
      const [submission] = await tx`INSERT INTO submissions(assignment_id,student_id) VALUES(${c.assignmentId},${c.studentId}) ON CONFLICT(assignment_id,student_id) DO UPDATE SET last_saved_at=submissions.last_saved_at RETURNING id`;
      await tx`INSERT INTO paper_pages(submission_id,page_index) VALUES(${submission.id},${c.pageIndex}) ON CONFLICT DO NOTHING`;
      const [page] = await tx`SELECT * FROM paper_pages WHERE submission_id=${submission.id} AND page_index=${c.pageIndex} FOR UPDATE`;
      if (page.status === "processing") throw new Error("PAGE_BUSY");
      if (page.revision !== body.baseRevision) throw new Error("REVISION_CONFLICT");
      const draft = cleanDraft(body.draft, page.draft as PaperDraft, page.results as PrivatePaperResult[], c.questions);
      await tx`UPDATE paper_pages SET draft=${tx.json(draft)},revision=revision+1,updated_at=now() WHERE id=${page.id}`;
      await tx`UPDATE submissions SET last_saved_at=now() WHERE id=${submission.id}`;
      return Number(page.revision) + 1;
    });
    return ok({ revision });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, params: Params) {
  try {
    const c = await context(params);
    if (!rateLimit(`paper:${c.studentId}`, 12, 60_000)) return fail("RATE_LIMITED", "Please wait a moment before submitting again.", 429);
    const body = bodySchema.parse(await bodyJson(request, 3_000_000));
    const key = z.string().min(16).max(120).parse(request.headers.get("idempotency-key"));
    const [family] = await sql`SELECT value FROM app_settings WHERE key='family'`;
    const aiReady = paperAiEnvironmentReady() && (family?.value as {externalAiOptIn?:boolean})?.externalAiOptIn === true;
    const started = await sql.begin(async tx => {
      await tx`SELECT 1 FROM study_clocks WHERE assignment_id=${c.assignmentId} AND student_id=${c.studentId} FOR UPDATE`;
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`${c.studentId}:${c.assignmentId}:${c.pageIndex}`}))`;
      const [submission] = await tx`INSERT INTO submissions(assignment_id,student_id) VALUES(${c.assignmentId},${c.studentId}) ON CONFLICT(assignment_id,student_id) DO UPDATE SET last_saved_at=submissions.last_saved_at RETURNING id`;
      await tx`INSERT INTO paper_pages(submission_id,page_index) VALUES(${submission.id},${c.pageIndex}) ON CONFLICT DO NOTHING`;
      const [page] = await tx`SELECT * FROM paper_pages WHERE submission_id=${submission.id} AND page_index=${c.pageIndex} FOR UPDATE`;
      const [prior] = await tx`SELECT id,state FROM paper_runs WHERE page_id=${page.id} AND idempotency_key=${key}`;
      if (prior) return { duplicate: true as const };
      await runningClock(tx,c.studentId,c.assignmentId);
      if (page.status === "processing") throw new Error("PAGE_BUSY");
      if (page.revision !== body.baseRevision) throw new Error("REVISION_CONFLICT");
      const previous = page.results as PrivatePaperResult[];
      const targets = c.questions.filter(q => previous.find(r => r.questionId === q.id)?.status !== "correct");
      if (!targets.length) throw new Error("ALL_CORRECT");
      const draft = cleanDraft(body.draft, page.draft as PaperDraft, previous, c.questions);
      const missing=missingPaperQuestions(c.questions,draft,previous,c.pageIndex);
      if(missing.length)throw new IncompletePage(missing);
      const needsAi = targets.some(q => (draft[q.id]?.strokes.length ?? 0) > 0 || q.answer_key.kind === "rubric" && !!draft[q.id]?.text.trim());
      const reserve = needsAi && aiReady ? .25 : 0;
      if (reserve) {
        await tx`SELECT pg_advisory_xact_lock(163021, 2)`;
        await tx`SELECT pg_advisory_xact_lock(hashtext('shared-ai-budget'))`;
        const budget = Number(process.env.AI_MONTHLY_BUDGET_USD || "10");
        const [usage] = await tx`SELECT ((SELECT coalesce(sum(reserved_cost_usd),0) FROM paper_runs WHERE created_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM upload_extractions WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM worksheet_generation_items WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_images WHERE updated_at>=date_trunc('month',now()))+(SELECT coalesce(sum(reserved_cost_usd),0) FROM vocab_photo_imports WHERE updated_at>=date_trunc('month',now())))::float8 amount`;
        if (!Number.isFinite(budget) || Number(usage.amount) + reserve > budget) throw new Error("BUDGET_LIMIT");
      }
      const clock=await changeClock(tx,c.studentId,c.assignmentId,"finish");
      const [run] = await tx`INSERT INTO paper_runs(page_id,idempotency_key,revision,reserved_cost_usd,model,duration_ms) VALUES(${page.id},${key},${Number(page.revision)+1},${reserve},${reserve ? process.env.OPENAI_MODEL || "gpt-6-luna" : null},${clock.elapsedMs}) RETURNING id`;
      await tx`UPDATE paper_pages SET draft=${tx.json(draft)},revision=revision+1,status='processing',updated_at=now() WHERE id=${page.id}`;
      await tx`UPDATE submissions SET last_saved_at=now() WHERE id=${submission.id}`;
      return { duplicate: false as const, pageId: page.id as string, runId: run.id as string, submissionId: submission.id as string, previous, targets, draft };
    });
    if (started.duplicate) return ok(await readPaper(c.studentId, c.assignmentId, c.pageIndex, c.questions.length));
    try {
      const png = await sharp(Buffer.from(paperSvg(c.questions, c.assignment.title as string, c.pageIndex, started.draft))).png().toBuffer();
      await sql`UPDATE paper_runs SET snapshot_png=${png} WHERE id=${started.runId}`;
      const deterministic: PrivatePaperResult[] = [], aiQuestions = [];
      for (const question of started.targets) {
        const answer = started.draft[question.id];
        if (!answer || !answer.text.trim() && !answer.strokes.length) deterministic.push({questionId:question.id,status:"incorrect",points:0,reason:"Answer box is blank.",confidence:1});
        else if (!answer.strokes.length && question.answer_key.kind !== "rubric") deterministic.push(gradeTyped(question, answer.text));
        else aiQuestions.push(question);
      }
      let inputTokens = 0, outputTokens = 0;
      if (aiQuestions.length && aiReady) {
        const ai = await gradePaperImage(png, aiQuestions.map(q=>({...q,studentText:started.draft[q.id]?.text||""})));
        deterministic.push(...ai.results); inputTokens = ai.inputTokens; outputTokens = ai.outputTokens;
      } else for (const question of aiQuestions) deterministic.push({questionId:question.id,status:"needs_review",points:null,reason:"AI is not configured; parent review required.",confidence:0});
      const results = mergePaperResults(started.previous, deterministic, c.questions);
      const status = results.some(r => r.status === "needs_review") ? "needs_review" : "graded";
      await sql.begin(async tx => {
        await tx`SELECT id FROM paper_pages WHERE id=${started.pageId} FOR UPDATE`;
        const changed = await tx`UPDATE paper_runs SET state='succeeded',results=${tx.json(results)},input_tokens=${inputTokens},output_tokens=${outputTokens},completed_at=now() WHERE id=${started.runId} AND state='processing' RETURNING id`;
        if (!changed.length) return;
        await tx`UPDATE paper_pages SET results=${tx.json(results)},status=${status},updated_at=now() WHERE id=${started.pageId}`;
        const [total] = await tx`SELECT count(*)::int count FROM assignment_questions WHERE assignment_id=${c.assignmentId}`;
        const pages = await tx`SELECT results,status FROM paper_pages WHERE submission_id=${started.submissionId}`;
        const allResults = pages.flatMap(p => p.results as PrivatePaperResult[]);
        const complete = allResults.length === Number(total.count) && allResults.every(r => r.status === "correct");
        await tx`UPDATE submissions SET status=${complete ? "completed" : pages.some(p=>p.status==="needs_review") ? "needs_review" : "in_progress"},last_saved_at=now(),submitted_at=now(),completed_at=${complete ? new Date() : null} WHERE id=${started.submissionId}`;
      });
    } catch (error) {
      const allowedErrors = ["AI_BILLING_LIMIT","AI_KEY_INVALID","AI_RATE_LIMIT","AI_PROVIDER_FAILED","AI_RESPONSE_INCOMPLETE","AI_QUESTION_MISMATCH"];
      if(error instanceof IncompletePage)return fail("INCOMPLETE_PAGE","Finish every question on this page before submitting.",422,undefined,{missingQuestions:error.missingQuestions});
  const code = error instanceof Error && allowedErrors.includes(error.message) ? error.message : "PAGE_GRADING_FAILED";
      await sql`UPDATE paper_runs SET state='failed',error_code=${code},completed_at=now() WHERE id=${started.runId} AND state='processing'`;
      await sql`UPDATE paper_pages SET status='failed',updated_at=now() WHERE id=${started.pageId} AND status='processing'`;
    }
    return ok(await readPaper(c.studentId, c.assignmentId, c.pageIndex, c.questions.length));
  } catch (error) { return errorResponse(error); }
}
