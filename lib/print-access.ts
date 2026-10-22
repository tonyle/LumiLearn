import {getSession} from "./auth";
import {sql} from "./db";
import type {LetterSection} from "./letter-layout";
import type {PaperQuestion} from "./paper";
export async function printAssignment(id:string):Promise<LetterSection>{
 const session=await getSession();if(!session)throw Error('UNAUTHORIZED');
 const [assignment]=await sql`SELECT a.id,a.title FROM assignments a WHERE a.id=${id} AND (${session.role==='parent'} OR (a.state IN ('assigned','closed') AND EXISTS(SELECT 1 FROM assignment_students ast WHERE ast.assignment_id=a.id AND ast.student_id=${session.studentId})))`;
 if(!assignment)throw Error('FORBIDDEN');
 const rows=await sql`SELECT qv.id,q.type,qv.prompt,qv.options FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${id} ORDER BY aq.sort_order`;
 return{title:assignment.title as string,questions:rows as unknown as PaperQuestion[]};
}
export async function samplePrintSections():Promise<LetterSection[]>{
 const session=await getSession();if(session?.role!=='parent')throw Error('UNAUTHORIZED');
 const sets=await sql`SELECT id,title FROM assignments WHERE state='assigned' AND source_assignment_id IS NOT NULL ORDER BY title`;
 const sections:LetterSection[]=[];
 for(const set of sets){const rows=await sql`SELECT qv.id,q.type,qv.prompt,qv.options FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${set.id} ORDER BY aq.sort_order`;sections.push({title:set.title as string,questions:rows as unknown as PaperQuestion[]});}
 return sections;
}
