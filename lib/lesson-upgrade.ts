import type {TransactionSql} from 'postgres';
import {tenQuestionLessons} from './lesson-batches';
import type {PaperDraft,PrivatePaperResult} from './paper';
export async function upgradeLesson(tx:TransactionSql,sourceId:string,additionalStudents:string[]=[]){
 const [source]=await tx`SELECT * FROM assignments WHERE id=${sourceId} FOR UPDATE`;
 const rows=await tx`SELECT aq.question_version_id,q.grade,q.subject_code FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE aq.assignment_id=${sourceId} ORDER BY aq.sort_order`;
 if(!rows.length)return;
 const pool=await tx`SELECT qv.id FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE q.grade=${rows[0].grade} AND q.subject_code=${rows[0].subject_code} AND q.state='published' AND qv.version=q.current_version ORDER BY q.created_at,q.id`;
 const batches=tenQuestionLessons(rows.map(r=>String(r.question_version_id)),pool.map(r=>String(r.id)));
 const oldStudents=await tx`SELECT student_id FROM assignment_students WHERE assignment_id=${sourceId}`;
 const students=[...new Set([...oldStudents.map(s=>String(s.student_id)),...additionalStudents])];
 for(let i=0;i<batches.length;i++){
  let [lesson]=await tx`SELECT id FROM assignments WHERE source_assignment_id=${sourceId} AND lesson_number=${i+1}`;
  if(!lesson){
   [lesson]=await tx`INSERT INTO assignments(title,description,state,max_attempts,created_by,source_assignment_id,lesson_number) VALUES(${String(source.title).replace(' · Practice pack','')+` · Lesson ${i+1}`},'Ten questions. Take a pause whenever you need one.','assigned',${source.max_attempts},${source.created_by},${sourceId},${i+1}) RETURNING id`;
   for(let n=0;n<10;n++)await tx`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${lesson.id},${batches[i][n]},${n})`;
  }
  for(const studentId of students){
   await tx`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${lesson.id},${studentId}) ON CONFLICT DO NOTHING`;
   const [old]=await tx`SELECT p.*,s.started_at,s.last_saved_at FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${sourceId} AND s.student_id=${studentId} AND p.page_index=${i}`;
   if(!old)continue;
   const [existing]=await tx`SELECT id FROM submissions WHERE assignment_id=${lesson.id} AND student_id=${studentId}`;if(existing)continue;
   const [sub]=await tx`INSERT INTO submissions(assignment_id,student_id,started_at,last_saved_at) VALUES(${lesson.id},${studentId},${old.started_at},${old.last_saved_at}) RETURNING id`;
   const draft=Object.fromEntries(Object.entries(old.draft as PaperDraft).filter(([id])=>batches[i].includes(id)));
   const results=(old.results as PrivatePaperResult[]).filter(r=>batches[i].includes(r.questionId));
   const complete=results.length===10&&results.every(r=>r.status==='correct');
   const status=results.length===10?results.some(r=>r.status==='needs_review')?'needs_review':'graded':'draft';
   await tx`INSERT INTO paper_pages(submission_id,page_index,revision,draft,results,status,updated_at) VALUES(${sub.id},0,${old.revision},${tx.json(draft)},${tx.json(results)},${status},${old.updated_at})`;
   if(complete)await tx`UPDATE submissions SET status='completed',completed_at=${old.updated_at} WHERE id=${sub.id}`;
  }
 }
 await tx`UPDATE assignments SET state='closed',updated_at=now() WHERE id=${sourceId}`;
 return batches.length;
}
