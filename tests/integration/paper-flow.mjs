// Creates and removes its own disposable learner and assignment. Never edits family work.
import postgres from "postgres";
import assert from "node:assert/strict";
import {createHash} from 'node:crypto';
import {hash} from '@node-rs/argon2';
import {execFileSync} from 'node:child_process';
assert.match(execFileSync('fc-match',['--format=%{file}','serif'],{encoding:'utf8'}),/DejaVu.*\.ttf/);
const db=postgres(process.env.DATABASE_URL,{max:1});
const base="http://127.0.0.1:3000";
let student,assignment,pageId,parentToken,otherToken;
const runKey=crypto.randomUUID();
async function request(path,{cookie,method="GET",body,key}={}){
 const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{"content-type":"application/json"}:{}),...(key?{"idempotency-key":key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=await response.json();return{status:response.status,data:json.data,cookie:response.headers.get("set-cookie")?.split(";")[0],error:json.error};
}
try{
 const [parent]=await db`SELECT id FROM parents ORDER BY created_at LIMIT 1`;
 const pinHash=await hash('173829');
 [student]=await db`INSERT INTO students(nickname,grade,pin_hash) VALUES('Disposable paper QA','1',${pinHash}) RETURNING id,login_name`;
 [assignment]=await db`INSERT INTO assignments(title,state,created_by) VALUES('Disposable paper QA','assigned',${parent.id}) RETURNING id`;
 await db`INSERT INTO assignment_students(assignment_id,student_id) VALUES(${assignment.id},${student.id})`;
 const questions=await db`SELECT qv.id,qv.answer_key,q.type FROM question_sets qs JOIN questions q ON q.set_id=qs.id JOIN question_versions qv ON qv.question_id=q.id WHERE qs.external_set_id='coppell-demo-grade1-math-v1' AND qv.answer_key->>'kind'<>'rubric' ORDER BY q.external_id LIMIT 10`;
 assert.equal(questions.length,10);
 for(let i=0;i<questions.length;i++)await db`INSERT INTO assignment_questions(assignment_id,question_version_id,sort_order) VALUES(${assignment.id},${questions[i].id},${i})`;
 const auth=await request('/api/auth/student/login',{method:'POST',body:{loginName:student.login_name,pin:'173829'}});assert.equal(auth.status,200);
 const endpoint=`/api/student/assignments/${assignment.id}/pages/0`,cookie=auth.cookie;
 await request(`/api/student/assignments/${assignment.id}/timer`,{cookie,method:"POST",body:{action:"start"}});
 const initial=await request(endpoint,{cookie});assert.equal(initial.data.revision,0);
 const draft={};
 for(const q of questions){const a=q.answer_key;const text=a.kind==='option_id'?a.optionId:a.kind==='option_ids'?a.optionIds.join(','):a.kind==='ordered_ids'?a.orderedIds.join(','):a.kind==='text'?a.accepted[0]:a.kind==='rubric'?'':String(a.value);draft[q.id]={text,strokes:[]};}
 draft[questions[0].id].text='not an answer';
 const saved=await request(endpoint,{cookie,method:'PUT',body:{baseRevision:0,draft}});assert.equal(saved.status,200);
 const graded=await request(endpoint,{cookie,method:'POST',body:{baseRevision:saved.data.revision,draft},key:runKey});assert.equal(graded.status,200,JSON.stringify(graded.error));assert.equal(graded.data.feedback.earned,90);assert.equal(graded.data.feedback.maximum,100);
 const duplicate=await request(endpoint,{cookie,method:'POST',body:{baseRevision:saved.data.revision,draft},key:runKey});assert.equal(duplicate.status,200);assert.equal(duplicate.data.revision,graded.data.revision);
 [pageId]=await db`SELECT p.id FROM paper_pages p JOIN submissions s ON s.id=p.submission_id WHERE s.assignment_id=${assignment.id}`;pageId=pageId.id;
 const [count]=await db`SELECT count(*)::int count, min(octet_length(snapshot_png))::int bytes FROM paper_runs WHERE page_id=${pageId}`;assert.equal(count.count,1);assert.ok(count.bytes>1000);
 const journal=await fetch(base+`/s/${student.id}/history`,{headers:{cookie}});assert.equal(journal.status,200);const journalHtml=await journal.text();assert.ok(journalHtml.includes('90 / 100'));assert.ok(journalHtml.includes('Disposable paper QA'));
 const correct=graded.data.feedback.results.find(r=>r.status==='correct').questionId;
 await request(`/api/student/assignments/${assignment.id}/timer`,{cookie,method:"POST",body:{action:"resume"}});
 const changed=structuredClone(draft);changed[correct].text='tampered answer';
 const updated=await request(endpoint,{cookie,method:'PUT',body:{baseRevision:graded.data.revision,draft:changed}});assert.equal(updated.status,200);
 const reloaded=await request(endpoint,{cookie});assert.equal(reloaded.data.draft[correct].text,draft[correct].text);
 const wrong=graded.data.feedback.results.find(r=>r.status==='incorrect').questionId;
 const [family]=await db`SELECT value FROM app_settings WHERE key='family'`;
 const enabled=process.env.AI_ENABLED==='true'&&process.env.EXTERNAL_AI_OPT_IN==='true'&&!!process.env.OPENAI_API_KEY&&family.value.externalAiOptIn;
 if(!enabled){
  const retry=structuredClone(reloaded.data.draft);retry[wrong]={text:'',strokes:[{tool:'pen',points:[{x:.2,y:.3,p:.5},{x:.7,y:.5,p:.8}]}]};
  const again=await request(endpoint,{cookie,method:'POST',body:{baseRevision:reloaded.data.revision,draft:retry},key:crypto.randomUUID()});assert.equal(again.data.feedback.earned,90);assert.equal(again.data.feedback.results.find(r=>r.questionId===wrong).status,'needs_review');
 }
 const forbidden=await request(`/api/parent/paper/${pageId}/image`,{cookie});assert.equal(forbidden.status,403);
 const [other]=await db`SELECT id FROM students WHERE id<>${student.id} AND active=true LIMIT 1`;
 otherToken=crypto.randomUUID();await db`INSERT INTO sessions(role,student_id,token_hash,expires_at) VALUES('student',${other.id},${createHash('sha256').update(otherToken).digest('hex')},now()+interval '1 minute')`;const otherAuth={cookie:`lumi_session=${otherToken}`};
 const cross=await request(endpoint,{cookie:otherAuth.cookie});assert.equal(cross.status,403);
 parentToken=crypto.randomUUID();
 await db`INSERT INTO sessions(role,parent_id,token_hash,expires_at) VALUES('parent',${parent.id},${createHash('sha256').update(parentToken).digest('hex')},now()+interval '5 minutes')`;
 const parentCookie=`lumi_session=${parentToken}`;
 const snapshot=await fetch(base+`/api/parent/paper/${pageId}/image`,{headers:{cookie:parentCookie}});assert.equal(snapshot.status,200);assert.ok((await snapshot.arrayBuffer()).byteLength>1000);
 const override=await request(`/api/parent/paper/${pageId}`,{cookie:parentCookie,method:'POST',body:{results:questions.map(q=>({questionId:q.id,status:'correct'}))}});assert.equal(override.status,200);
 const final=await request(endpoint,{cookie});assert.equal(final.data.feedback.earned,100);assert.equal(final.data.feedback.pending,0);
 assert.ok(!JSON.stringify(graded.data).match(/answer_key|private_reason|transcription|sampleAnswer/));
 console.log('Paper integration passed: batch 90/100, idempotency, PNG capture, autosave/reload, correct-answer lock, pending handwriting, parent-image protection, cross-learner isolation, parent override to 100/100.');
}finally{
 if(pageId)await db`DELETE FROM audit_events WHERE entity_id=${pageId} AND action='paper_grade_override'`;
 if(otherToken)await db`DELETE FROM sessions WHERE token_hash=${createHash("sha256").update(otherToken).digest("hex")}`;
 if(parentToken)await db`DELETE FROM sessions WHERE token_hash=${createHash('sha256').update(parentToken).digest('hex')}`;
 if(assignment)await db`DELETE FROM assignments WHERE id=${assignment.id}`;
 if(student)await db`DELETE FROM students WHERE id=${student.id}`;
 await db.end();
}
