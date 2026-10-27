import {z} from 'zod';import {requireRole} from '@/lib/auth';import {sql} from '@/lib/db';import {bodyJson,fail,ok} from '@/lib/http';import {changeClock,readClock} from '@/lib/study-clock-store';import {hasSameOrigin} from '@/lib/request-origin';
async function owner(params:Promise<{id:string}>){const session=await requireRole('student');const {id}=await params;z.string().uuid().parse(id);const [a]=await sql`SELECT a.state FROM assignments a JOIN assignment_students ast ON ast.assignment_id=a.id WHERE a.id=${id} AND ast.student_id=${session.studentId}`;if(!a)throw Error('FORBIDDEN');return {studentId:session.studentId!,assignmentId:id,active:a.state==='assigned'};}
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const c=await owner(params);return ok(await readClock(c.studentId,c.assignmentId));}catch{return fail('FORBIDDEN','This timer is not available.',403);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const c=await owner(params);if(!c.active)return fail('CLOSED','This is an earlier worksheet. Open a new lesson to practise.',409);if(!hasSameOrigin(request))return fail('FORBIDDEN','Invalid origin.',403);
 const {action}=z.object({action:z.enum(['start','resume','pause','heartbeat'])}).parse(await bodyJson(request,1000));
 const clock=await sql.begin(async tx=>{
  if(action==='start'){
   const [graded]=await tx`SELECT 1 FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${c.assignmentId} AND s.student_id=${c.studentId} AND p.status IN ('graded','needs_review') LIMIT 1`;
   if(graded){const current=await changeClock(tx,c.studentId,c.assignmentId,'read');if(!current.started)return current;}
  }
  return changeClock(tx,c.studentId,c.assignmentId,action);
 });return ok(clock);
 }catch(error){if(error instanceof Error&&error.message==='WORKSHEET_COMPLETED')return fail('WORKSHEET_COMPLETED','This worksheet is completed. Ask your parent to reopen it.',409);return error instanceof z.ZodError?fail('VALIDATION','Choose a valid timer action.',422):fail('FORBIDDEN','This timer is not available.',403);}
}
