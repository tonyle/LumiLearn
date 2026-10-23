import postgres from 'postgres';import {hash} from '@node-rs/argon2';import {randomUUID,createHash} from 'node:crypto';import {writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=postgres(process.env.DATABASE_URL,{max:1});let fixture={studentId:null,assignments:[],tokenHashes:[]};const path='/tmp/student-subject-qa.json';
async function cleanup(){for(const id of fixture.assignments)await db`DELETE FROM assignments WHERE id=${id}`;if(fixture.studentId)await db`DELETE FROM students WHERE id=${fixture.studentId}`;for(const tokenHash of fixture.tokenHashes)await db`DELETE FROM sessions WHERE token_hash=${tokenHash}`;}
if(process.env.CLEAN_SUBJECT_QA==='1'){fixture=JSON.parse(await readFile(path,'utf8'));await cleanup();await db.end();console.log('Removed exact disposable subject-tab fixtures.');process.exit(0);}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;
 const [student]=await db`INSERT INTO students(nickname,grade,login_name,pin_hash) VALUES('Subject tabs QA','3','subject-tabs-qa',${await hash('654321')}) RETURNING id`;fixture.studentId=student.id;
 for(const [subject,title] of [['math','QA A curious discovery'],['science','QA Number explorers']]){
  const qs=await db`SELECT qv.id FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE q.subject_code=${subject} ORDER BY qv.id LIMIT 10`;assert.equal(qs.length,10);
  const [a]=await db`INSERT INTO assignments(title,state,created_by) VALUES(${title},'draft',${parent.id}) RETURNING id`;fixture.assignments.push(a.id);
  for(let i=0;i<10;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${a.id},${qs[i].id},${i})`;
  await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${a.id},${student.id})`;await db`UPDATE assignments SET state='assigned' WHERE id=${a.id}`;
  const [sub]=await db`INSERT INTO submissions(assignment_id,student_id) VALUES(${a.id},${student.id}) RETURNING id`;
  const [page]=await db`INSERT INTO paper_pages(submission_id,page_index) VALUES(${sub.id},0) RETURNING id`;
  const results=qs.map(q=>({questionVersionId:q.id,status:'correct',points:10}));
  await db`INSERT INTO paper_runs(page_id,idempotency_key,revision,state,results,created_at) VALUES(${page.id},${randomUUID()},1,'succeeded',${db.json(results)},'2026-10-21T17:00:00Z')`;
 }
 await writeFile(path,JSON.stringify(fixture));
 const token=randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');fixture.tokenHashes.push(tokenHash);await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${student.id},${tokenHash},now()+interval '15 minutes')`;
 async function html(suffix){const response=await fetch(`http://127.0.0.1:3000/s/${student.id}/${suffix}`,{headers:{cookie:`lumi_session=${token}`}});assert.equal(response.status,200);return (await response.text()).replaceAll('<!-- -->','');}
 for(const subject of ['math','science']){const yes=subject==='math'?'QA A curious discovery':'QA Number explorers',no=subject==='math'?'QA Number explorers':'QA A curious discovery';const home=await html(`home?subject=${subject}`);assert.ok(home.includes(yes));assert.ok(!home.includes(no));const history=await html(`history?subject=${subject}&date=2026-10-21`);assert.ok(history.includes(yes));assert.ok(!history.includes(no));assert.ok(history.includes(`name="subject" value="${subject}"`));assert.ok(history.includes(`&amp;subject=${subject}`));assert.ok(history.includes('100 / 100'));}
 const empty=await html('home?subject=writing&status=all');assert.ok(empty.includes('No writing worksheets yet'));assert.ok(!empty.includes('QA Number explorers'));assert.ok(!empty.includes('QA A curious discovery'));
 await writeFile(path,JSON.stringify(fixture));console.log(JSON.stringify({passed:true,studentId:student.id,username:'subject-tabs-qa',checks:'Real subject metadata controls both lists despite misleading titles; history date and subject persist; empty subject is isolated.'}));
}finally{if(process.env.KEEP_SUBJECT_QA!=='1')await cleanup();await db.end();}
