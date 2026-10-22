import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
const db=postgres(process.env.DATABASE_URL,{max:1});let student,assignment;const token=randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');
async function request(path,method='GET',body){const response=await fetch('http://127.0.0.1:3000'+path,{method,headers:{cookie:`lumi_session=${token}`,'content-type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;
 [student]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable completion QA','1') RETURNING id`;
 [assignment]=await db`INSERT INTO assignments(title,state,created_by) VALUES('Disposable completion QA','assigned',${parent.id}) RETURNING id`;
 await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${assignment.id},${student.id})`;
 const questions=await db`SELECT qv.id,qv.answer_key FROM question_versions qv WHERE qv.answer_key->>'kind'='number' LIMIT 3`;assert.equal(questions.length,3);
 for(let i=0;i<3;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${assignment.id},${questions[i].id},${i})`;
 await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${student.id},${tokenHash},now()+interval '5 minutes')`;
 const endpoint=`/api/student/assignments/${assignment.id}/pages/0`;
 await request(`/api/student/assignments/${assignment.id}/timer`,'POST',{action:'start'});
 const draft={[questions[0].id]:{text:'0',strokes:[]}};
 const rejected=await request(endpoint,'POST',{baseRevision:0,draft});assert.equal(rejected.status,422);assert.equal(rejected.error.code,'INCOMPLETE_PAGE');assert.deepEqual(rejected.error.details.missingQuestions,[2,3]);
 const [count]=await db`SELECT count(*)::int count FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${assignment.id}`;assert.equal(count.count,0);
 for(const q of questions)draft[q.id]={text:String(q.answer_key.value),strokes:[]};
 const graded=await request(endpoint,'POST',{baseRevision:0,draft});assert.equal(graded.status,200);assert.equal(graded.data.feedback.earned,30);
 console.log('Completion integration passed: blanks rejected with numbers, no grading run or revision created, all answered page grades 30/30.');
}finally{await db`DELETE FROM sessions WHERE token_hash=${tokenHash}`;if(assignment)await db`DELETE FROM assignments WHERE id=${assignment.id}`;if(student)await db`DELETE FROM students WHERE id=${student.id}`;await db.end();}
