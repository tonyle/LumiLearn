import postgres from 'postgres';import {hash} from '@node-rs/argon2';import {randomUUID,createHash} from 'node:crypto';import {writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=postgres(process.env.DATABASE_URL,{max:1});const fixturePath='/tmp/student-learning-list-qa.json';let fixture={studentId:null,assignments:[],tokens:[]};
async function cleanup(){for(const id of fixture.assignments)await db`DELETE FROM assignments WHERE id=${id}`;if(fixture.studentId)await db`DELETE FROM students WHERE id=${fixture.studentId}`;for(const token of fixture.tokens)await db`DELETE FROM sessions WHERE token_hash=${token}`;}
if(process.env.CLEAN_LEARNING_QA==='1'){fixture=JSON.parse(await readFile(fixturePath,'utf8'));await cleanup();await db.end();console.log('Removed exact compact-learning QA data.');process.exit(0);}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;const [student]=await db`INSERT INTO students(nickname,grade,login_name,pin_hash) VALUES('Learning list QA','5','learning-list-qa',${await hash('654321')}) RETURNING id`;fixture.studentId=student.id;
 for(const subject of ['math','science']){
  const versions=await db`SELECT qv.id FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE q.subject_code=${subject} ORDER BY qv.id LIMIT 10`;assert.equal(versions.length,10);
  for(let i=0;i<(subject==='math'?21:1);i++){
   const status=i>=18?'completed':i>=15?'in_progress':null,title=`QA ${subject==='math'?'Decimal practice':'Forces and motion'} ${String(i+1).padStart(2,'0')}`;
   const [a]=await db`INSERT INTO assignments(title,state,created_by,created_at) VALUES(${title},'draft',${parent.id},now()-${i}*interval '1 minute') RETURNING id`;fixture.assignments.push(a.id);
   for(let j=0;j<10;j++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${a.id},${versions[j].id},${j})`;
   await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${a.id},${student.id})`;await db`UPDATE assignments SET state='assigned' WHERE id=${a.id}`;
   if(status)await db`INSERT INTO submissions(assignment_id,student_id,status) VALUES(${a.id},${student.id},${status})`;
  }
 }
 const token=randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');fixture.tokens.push(tokenHash);await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${student.id},${tokenHash},now()+interval '15 minutes')`;
 await writeFile(fixturePath,JSON.stringify(fixture));
 async function page(query){const r=await fetch(`http://127.0.0.1:3000/s/${student.id}/home${query}`,{headers:{cookie:`lumi_session=${token}`}});assert.equal(r.status,200);return (await r.text()).replaceAll('<!-- -->','');}
 const first=await page('');assert.ok(first.includes('1–12 of 18 worksheets'));assert.equal((first.match(/class="worksheet-compact-row"/g)||[]).length,12);for(let i=19;i<=21;i++)assert.ok(!first.includes(`QA Decimal practice ${i}`));assert.ok(!first.includes('QA Forces and motion'));assert.ok(first.includes('Page 1 of 2'));
 const second=await page('?subject=math&status=todo&page=2');assert.ok(second.includes('13–18 of 18 worksheets'));assert.equal((second.match(/class="worksheet-compact-row"/g)||[]).length,6);assert.ok(second.includes('subject=math&amp;status=todo'));
 const completed=await page('?subject=math&status=completed');for(let i=19;i<=21;i++)assert.ok(completed.includes(`QA Decimal practice ${i}`));assert.ok(!completed.includes('QA Decimal practice 01'));assert.equal((completed.match(/class="worksheet-compact-row"/g)||[]).length,3);
 const progress=await page('?subject=math&status=in_progress');assert.equal((progress.match(/class="worksheet-compact-row"/g)||[]).length,3);assert.ok(progress.includes('QA Decimal practice 16'));assert.ok(!progress.includes('QA Decimal practice 01'));
 const all=await page('?subject=math&status=all&page=99999');assert.ok(all.includes('Page 2 of 2'));assert.ok(all.includes('13–21 of 21 worksheets'));assert.ok(all.includes('QA Decimal practice 21'));
 const science=await page('?subject=science');assert.ok(science.includes('QA Forces and motion'));assert.ok(!science.includes('QA Decimal practice'));
 console.log(JSON.stringify({passed:true,studentId:student.id,checks:'Completed worksheets hidden by default; progress/completed/all filters; real SQL pagination 12+6; page clamping; subject isolation and preserved query parameters.'}));
}finally{if(process.env.KEEP_LEARNING_QA==='1')await writeFile(fixturePath,JSON.stringify(fixture));else await cleanup();await db.end();}
