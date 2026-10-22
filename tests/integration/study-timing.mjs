import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
const db=postgres(process.env.DATABASE_URL,{max:1});let student;const assignments=[],tokens=[];
async function cookie(studentId){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${studentId},${hash},now()+interval '5 minutes')`;return `lumi_session=${token}`;}
let auth;
async function request(path,method='GET',body,key=randomUUID(),session=auth){const response=await fetch('http://127.0.0.1:3000'+path,{method,headers:{cookie:session,'content-type':'application/json','idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;[student]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable timing QA','1') RETURNING id`;auth=await cookie(student.id);
 const questions=await db`SELECT id,answer_key FROM question_versions WHERE answer_key->>'kind'='number' LIMIT 11`;assert.equal(questions.length,11);
 for(let lesson=0;lesson<2;lesson++){
  const [a]=await db`INSERT INTO assignments(title,state,created_by) VALUES('Disposable timed lesson','assigned',${parent.id}) RETURNING id`;assignments.push(a.id);await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${a.id},${student.id})`;
  for(let i=0;i<3;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${a.id},${questions[i].id},${i})`;
  const endpoint=`/api/student/assignments/${a.id}`,started=await request(endpoint+'/timer','POST',{action:'start'});assert.equal(started.data.state,'running');
  await db`UPDATE study_clocks SET running_since=now()-interval '65 seconds',lease_until=now()+interval '45 seconds' WHERE assignment_id=${a.id} AND student_id=${student.id}`;
  const paused=await request(endpoint+'/timer','POST',{action:'pause'});assert.equal(paused.data.state,'paused');assert.ok(paused.data.elapsedMs>=65000);
  const reloaded=await request(endpoint+'/timer');assert.equal(reloaded.data.elapsedMs,paused.data.elapsedMs);assert.equal(reloaded.data.state,'paused');
  const draft=Object.fromEntries(questions.slice(0,3).map(q=>[q.id,{text:String(q.answer_key.value),strokes:[]}]));
  assert.equal((await request(endpoint+'/pages/0','PUT',{baseRevision:0,draft})).status,423);assert.equal((await request(endpoint+'/pages/0','POST',{baseRevision:0,draft})).status,423);
  const [peer]=await db`SELECT id FROM students WHERE id<>${student.id} LIMIT 1`;assert.equal((await request(endpoint+'/timer','POST',{action:'resume'},randomUUID(),await cookie(peer.id))).status,403);
  await request(endpoint+'/timer','POST',{action:'resume'});const key=randomUUID();const submitted=await request(endpoint+'/pages/0','POST',{baseRevision:0,draft},key);assert.equal(submitted.status,200);assert.equal(submitted.data.feedback.earned,30);assert.equal(submitted.data.clock.state,'submitted');assert.ok(submitted.data.clock.elapsedMs>=65000);
  const repeated=await request(endpoint+'/pages/0','POST',{baseRevision:0,draft},key);assert.equal(repeated.data.clock.elapsedMs,submitted.data.clock.elapsedMs);
  const [run]=await db`SELECT duration_ms FROM paper_runs r JOIN paper_pages p ON p.id=r.page_id JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${a.id}`;assert.equal(Number(run.duration_ms),submitted.data.clock.elapsedMs);
 }
 const [cap]=await db`INSERT INTO assignments(title,state,created_by) VALUES('Disposable cap QA','assigned',${parent.id}) RETURNING id`;assignments.push(cap.id);
 for(let i=0;i<10;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${cap.id},${questions[i].id},${i})`;
 await assert.rejects(()=>db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${cap.id},${questions[10].id},10)`,/LESSON_QUESTION_LIMIT/);
 console.log('Timing integration passed: pause/reload freezes, paused writes and submit blocked, ownership, resume, duration snapshots, idempotent submit, two lessons in one day, 11th question rejected.');
}finally{for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;for(const id of assignments)await db`DELETE FROM assignments WHERE id=${id}`;if(student)await db`DELETE FROM students WHERE id=${student.id}`;await db.end();}
