import postgres from 'postgres';
import {hash} from '@node-rs/argon2';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const db=postgres(process.env.DATABASE_URL,{max:1});
let studentId,assignmentId;const sessions=[];
async function session(role,id){const token=randomUUID(),digest=createHash('sha256').update(token).digest('hex');sessions.push(digest);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${digest},now()+interval '15 minutes')`;return `lumi_session=${token}`;}
async function request(path,cookie,body,method=body?'POST':'GET',key,origin='http://127.0.0.1:3000'){const r=await fetch(`http://127.0.0.1:3000${path}`,{method,headers:{cookie,origin,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;
 const [st]=await db`INSERT INTO students(nickname,grade,login_name,pin_hash) VALUES('Two grading QA','5',${'two-grade-'+randomUUID()},${await hash('654321')}) RETURNING id`;studentId=st.id;
 const [a]=await db`INSERT INTO assignments(title,state,created_by) VALUES('Two grading completion QA','draft',${parent.id}) RETURNING id`;assignmentId=a.id;
 const qs=await db`SELECT qv.id,qv.answer_key FROM question_versions qv JOIN questions q ON q.id=qv.question_id WHERE q.subject_code='math' AND qv.answer_key->>'kind'='number' LIMIT 10`;assert.equal(qs.length,10);
 for(let i=0;i<10;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${a.id},${qs[i].id},${i})`;
 await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${a.id},${studentId})`;await db`UPDATE assignments SET state='assigned' WHERE id=${a.id}`;
 const auth=await session('student',studentId),parentAuth=await session('parent',parent.id),base=`/api/student/assignments/${a.id}`,reopen=`/api/parent/assignments/${a.id}/reopen`;
 assert.equal((await request(base+'/timer',auth,{action:'start'})).status,200);
 const wrong=Object.fromEntries(qs.map(q=>[q.id,{text:'999999999',strokes:[]}]));
 const incomplete=await request(base+'/pages/0',auth,{baseRevision:0,draft:{}},'POST',randomUUID());assert.equal(incomplete.status,422);
 const firstKey=randomUUID(),body={baseRevision:0,draft:wrong};
 const first=await request(base+'/pages/0',auth,body,'POST',firstKey);assert.equal(first.status,200,JSON.stringify(first));assert.equal(first.data.gradingAttempts,1);assert.equal(first.data.completed,false);assert.equal(first.data.feedback.earned,0);
 const duplicate=await request(base+'/pages/0',auth,body,'POST',firstKey);assert.equal(duplicate.status,200);assert.equal(duplicate.data.gradingAttempts,1);
 const [p]=await db`SELECT p.id,p.submission_id FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${a.id}`;
 await db`INSERT INTO paper_runs(page_id,idempotency_key,revision,state) VALUES(${p.id},${randomUUID()},1,'failed')`;
 assert.equal((await request(base+'/pages/0',auth)).data.gradingAttempts,1);
 await request(base+'/timer',auth,{action:'resume'});
 const secondKey=randomUUID(),secondBody={baseRevision:first.data.revision,draft:wrong};
 const second=await request(base+'/pages/0',auth,secondBody,'POST',secondKey);assert.equal(second.status,200,JSON.stringify(second));assert.equal(second.data.completed,true);assert.equal(second.data.gradingAttempts,2);assert.equal(second.data.feedback.earned,0);
 assert.equal((await request(base+'/pages/0',auth,secondBody,'POST',secondKey)).data.gradingAttempts,2);
 assert.equal((await request(base+'/timer',auth,{action:'resume'})).status,409);
 assert.equal((await request(base+'/pages/0',auth,{baseRevision:second.data.revision,draft:wrong},'PUT')).status,409);
 assert.equal((await request(base+'/pages/0',auth,{baseRevision:second.data.revision,draft:wrong},'POST',randomUUID())).status,409);
 const changed={...wrong,[qs[0].id]:{text:'new overwrite',strokes:[]}};
 assert.equal((await request(base+'/exit',auth,{pageIndex:0,baseRevision:second.data.revision,draft:changed})).status,409);
 assert.equal((await request(base+'/exit',auth,{pageIndex:0,baseRevision:second.data.revision,draft:wrong})).status,200);
 // Parent grade changes cannot silently reopen a completed lesson.
 assert.equal((await request(`/api/parent/paper/${p.id}`,parentAuth,{results:qs.map(q=>({questionId:q.id,status:'incorrect'}))})).status,200);
 assert.equal((await request(base+'/pages/0',auth)).data.completed,true);
 assert.equal((await request(reopen,auth,{studentId})).status,401);
 assert.equal((await request(reopen,parentAuth,{studentId},'POST',undefined,'https://evil.example')).status,403);
 const html=await(await fetch('http://127.0.0.1:3000/parent/assignments',{headers:{cookie:parentAuth}})).text();assert.ok(html.includes('Reopen for Two grading QA'));
 assert.equal((await request(reopen,parentAuth,{studentId})).status,200);
 assert.equal((await request(reopen,parentAuth,{studentId})).status,409);
 const fresh=(await request(base+'/pages/0',auth)).data;assert.equal(fresh.completed,false);assert.equal(fresh.gradingAttempts,0);assert.deepEqual(fresh.draft,{});assert.equal(fresh.feedback,null);
 const [history]=await db`SELECT count(*)::int count FROM paper_runs WHERE page_id=${p.id} AND state='succeeded' AND snapshot_png IS NOT NULL`;assert.equal(history.count,2);
 await request(base+'/timer',auth,{action:'resume'});
 const again=await request(base+'/pages/0',auth,{baseRevision:fresh.revision,draft:wrong},'POST',randomUUID());assert.equal(again.status,200);assert.equal(again.data.completed,false);assert.equal(again.data.gradingAttempts,1);
 await request(base+'/timer',auth,{action:'resume'});
 const perfect=Object.fromEntries(qs.map(q=>[q.id,{text:String(q.answer_key.value),strokes:[]}]));
 const last=await request(base+'/pages/0',auth,{baseRevision:again.data.revision,draft:perfect},'POST',randomUUID());assert.equal(last.status,200);assert.equal(last.data.completed,true);assert.equal(last.data.feedback.earned,100);
 assert.equal((await request(reopen,parentAuth,{studentId})).status,200);
 const third=(await request(base+'/pages/0',auth)).data;await request(base+'/timer',auth,{action:'resume'});
 const firstPerfect=await request(base+'/pages/0',auth,{baseRevision:third.revision,draft:perfect},'POST',randomUUID());assert.equal(firstPerfect.data.gradingAttempts,1);assert.equal(firstPerfect.data.completed,true);
 assert.equal((await request(reopen,parentAuth,{studentId})).status,200);
 const [reward]=await db`SELECT sum(points)::int points FROM game_ledger WHERE student_id=${studentId} AND assignment_id=${a.id}`;assert.equal(reward.points,3);
 console.log('PASS: two gradings complete at 0/100; validation/failed/idempotent requests do not consume extra attempts; completed writing/timer/submit/exit blocked; parent role/origin and grade override protected; reopening resets two attempts and preserves immutable snapshots; perfect answers still complete.');
}finally{if(studentId)await db`DELETE FROM game_ledger WHERE student_id=${studentId}`;if(assignmentId)await db`DELETE FROM assignments WHERE id=${assignmentId}`;if(studentId)await db`DELETE FROM students WHERE id=${studentId}`;for(const digest of sessions)await db`DELETE FROM sessions WHERE token_hash=${digest}`;await db.end();}
