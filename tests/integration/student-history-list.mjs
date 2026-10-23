import postgres from 'postgres';import {hash} from '@node-rs/argon2';import {randomUUID,createHash} from 'node:crypto';import {writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=postgres(process.env.DATABASE_URL,{max:1});const fixturePath='/tmp/student-history-list-qa.json';let fixture={studentId:null,assignments:[],runs:[],tokens:[]};
async function cleanup(){for(const id of fixture.assignments)await db`DELETE FROM assignments WHERE id=${id}`;if(fixture.studentId)await db`DELETE FROM students WHERE id=${fixture.studentId}`;for(const token of fixture.tokens)await db`DELETE FROM sessions WHERE token_hash=${token}`;}
if(process.env.CLEAN_HISTORY_QA==='1'){fixture=JSON.parse(await readFile(fixturePath,'utf8'));await cleanup();await db.end();console.log('Removed exact compact-history QA fixtures.');process.exit(0);}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;const [student]=await db`INSERT INTO students(nickname,grade,login_name,pin_hash) VALUES('History list QA','5','history-list-qa',${await hash('654321')}) RETURNING id`;fixture.studentId=student.id;
 for(const subject of ['math','science']){
  const versions=await db`SELECT qv.id FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE q.subject_code=${subject} ORDER BY qv.id LIMIT 10`;assert.equal(versions.length,10);
  const [a]=await db`INSERT INTO assignments(title,state,created_by) VALUES(${subject==='math'?'QA Decimal multiplication':'QA Forces and motion'},'draft',${parent.id}) RETURNING id`;fixture.assignments.push(a.id);
  for(let i=0;i<10;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${a.id},${versions[i].id},${i})`;
  await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${a.id},${student.id})`;await db`UPDATE assignments SET state='assigned' WHERE id=${a.id}`;
  const [sub]=await db`INSERT INTO submissions(assignment_id,student_id) VALUES(${a.id},${student.id}) RETURNING id`;const [page]=await db`INSERT INTO paper_pages(submission_id,page_index) VALUES(${sub.id},0) RETURNING id`;
  for(let i=0;i<(subject==='math'?14:1);i++){
   const results=versions.map((v,j)=>({questionId:v.id,status:j<(i===0?3:i===12?0:1)?'incorrect':'correct',points:j<(i===0?3:i===12?0:1)?0:10}));
   const created=i===13?'2026-10-21T17:00:00Z':`2026-10-22T17:${String(i).padStart(2,'0')}:00Z`;
   const [run]=await db`INSERT INTO paper_runs(page_id,idempotency_key,revision,state,results,created_at,duration_ms) VALUES(${page.id},${randomUUID()},${i+1},'succeeded',${db.json(results)},${created},${60000+i*1000}) RETURNING id`;fixture.runs.push({id:run.id,subject,index:i});
  }
 }
 const token=randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');fixture.tokens.push(tokenHash);await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${fixture.studentId},${tokenHash},now()+interval '15 minutes')`;
 async function html(query){const r=await fetch(`http://127.0.0.1:3000/s/${fixture.studentId}/history${query}`,{headers:{cookie:`lumi_session=${token}`}});assert.equal(r.status,200);return (await r.text()).replaceAll('<!-- -->','');}
 const base='?subject=math&date=2026-10-22';const first=await html(base);assert.equal((first.match(/class="worksheet-compact-row history-compact-row"/g)||[]).length,12);assert.ok(first.includes('1–12 of 13 submissions'));assert.ok(!first.includes('QA Forces and motion'));assert.ok(first.includes('subject=math&amp;date=2026-10-22&amp;page=2'));
 const oldest=fixture.runs.find(r=>r.subject==='math'&&r.index===0),latest=fixture.runs.find(r=>r.subject==='math'&&r.index===12);
 assert.ok(first.includes(`/history/${latest.id}`));assert.ok(!first.includes(`/history/${oldest.id}`));
 const second=await html(base+'&page=2');assert.equal((second.match(/class="worksheet-compact-row history-compact-row"/g)||[]).length,1);assert.ok(second.includes('13–13 of 13 submissions'));assert.ok(second.includes(`/history/${oldest.id}`));assert.ok(!second.includes(`/history/${latest.id}`));assert.ok(second.includes('70<small> / 100'));
 const science=await html('?subject=science&date=2026-10-22');assert.ok(science.includes('QA Forces and motion'));assert.ok(!science.includes('QA Decimal multiplication'));
 const earlier=await html('?subject=math&date=2026-10-21');assert.ok(earlier.includes('1–1 of 1 submissions'));assert.ok(earlier.includes('value="2026-10-21"'));
 const clamped=await html(base+'&page=999');assert.ok(clamped.includes('Page 2 of 2'));
 console.log(JSON.stringify({passed:true,studentId:fixture.studentId,checks:'12+1 real database pagination, exact old-attempt links and score, subject/day isolation, clamped page, date field synchronization.'}));
}finally{if(process.env.KEEP_HISTORY_QA==='1')await writeFile(fixturePath,JSON.stringify(fixture));else await cleanup();await db.end();}
