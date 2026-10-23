import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {tsImport} from 'tsx/esm/api';
const {validateAuthorDraft}=await tsImport('/app/lib/worksheet-authoring.ts',import.meta.url);
const db=postgres(process.env.DATABASE_URL,{max:1});const tokens=[];let batchId,student,assignmentId,questionSetId;const draftIds=[];
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '15 minutes')`;return `lumi_session=${token}`;}
async function request(path,cookie,body,origin='http://127.0.0.1:3000'){const r=await fetch(`http://127.0.0.1:3000${path}`,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
try{
 const [parent]=await db`SELECT id FROM parents ORDER BY created_at LIMIT 1`;const auth=await session('parent',parent.id);
 [student]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable generation QA','5') RETURNING id`;const learnerAuth=await session('student',student.id);
 const parameters={grade:'5',subject:'math',topic:'Multiplying a decimal by a whole number, tenths and hundredths',count:2,difficulty:'grade_level',instructions:'Use numeric questions only, no diagrams, include two money word problems per worksheet.'};const body={creationKey:randomUUID().replaceAll('-',''),parameters};
 assert.equal((await request('/api/parent/generate',learnerAuth,body)).status,401);assert.equal((await request('/api/parent/generate',auth,body,'https://evil.example')).status,403);assert.equal((await request('/api/parent/generate',auth,{...body,parameters:{...parameters,count:11}})).status,422);
 const created=await request('/api/parent/generate',auth,body);assert.equal(created.status,201,JSON.stringify(created));batchId=created.data.id;
 assert.equal((await request('/api/parent/generate',auth,body)).data.id,batchId);assert.equal((await request('/api/parent/generate',auth,{...body,parameters:{...parameters,topic:'Changed topic'}})).status,409);
 const path=`/api/parent/generate/${batchId}`;assert.equal((await request(path,learnerAuth)).status,401);assert.equal((await request(path,auth)).data.items.length,2);
 console.log('Generating two disposable AI worksheets…');
 const firstPending=request(`${path}/items/0`,auth,{});await new Promise(resolve=>setTimeout(resolve,1000));assert.equal((await request(`${path}/items/0`,auth,{})).status,409);const first=await firstPending;assert.equal(first.status,201,JSON.stringify(first));assert.equal(first.data.items[0].state,'ready');const firstId=first.data.items[0].draft_id;draftIds.push(firstId);
 const reused=await request(`${path}/items/0`,auth,{});assert.equal(reused.status,200);assert.equal(reused.data.items[0].draft_id,firstId);
 // A prior failed attempt must not discard the first draft; the remaining slot can be retried.
 await db`UPDATE worksheet_generation_items SET state='failed',error_code='AI_RATE_LIMIT' WHERE batch_id=${batchId} AND position=1`;
 const second=await request(`${path}/items/1`,auth,{});assert.equal(second.status,201,JSON.stringify(second));draftIds.push(second.data.items[1].draft_id);assert.equal(second.data.items[0].draft_id,firstId);
 const drafts=await db`SELECT id,payload FROM worksheet_drafts WHERE id IN ${db(draftIds)}`;assert.equal(drafts.length,2);const texts=[];
 for(const draft of drafts){assert.equal(draft.payload.questions.length,10);assert.equal(validateAuthorDraft(draft.payload).success,true);texts.push(...draft.payload.questions.map(q=>q.text.trim().toLowerCase()));}
 assert.equal(new Set(texts).size,20);
 const published=await request(`/api/parent/worksheets/${firstId}/publish`,auth,{baseRevision:1,studentIds:[student.id]});assert.equal(published.status,201,JSON.stringify(published));assignmentId=published.data.assignmentId;questionSetId=published.data.questionSetId;
 assert.equal((await db`SELECT * FROM assignment_questions WHERE assignment_id=${assignmentId}`).length,10);assert.equal((await db`SELECT * FROM assignment_students WHERE assignment_id=${assignmentId}`).length,1);
 const pdf=await fetch(`http://127.0.0.1:3000/api/assignments/${assignmentId}/pdf`,{headers:{cookie:auth}});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/pdf/);
 console.log('Generation integration passed: two real AI worksheets / 20 valid distinct questions, durable partial progress and retry, idempotent batch/item requests, concurrent request exclusion, role/origin checks, assignment to QA student only, printable PDF.');
}finally{
 for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;
 if(batchId){const remaining=await db`SELECT draft_id FROM worksheet_generation_items WHERE batch_id=${batchId} AND draft_id IS NOT NULL`;draftIds.push(...remaining.map(r=>r.draft_id));await db`DELETE FROM worksheet_generation_batches WHERE id=${batchId}`;}
 if(draftIds.length)await db`DELETE FROM worksheet_drafts WHERE id IN ${db([...new Set(draftIds)])}`;
 if(assignmentId){await db`DELETE FROM audit_events WHERE entity_id=${assignmentId}`;await db`DELETE FROM assignments WHERE id=${assignmentId}`;}
 if(questionSetId){await db`DELETE FROM questions WHERE set_id=${questionSetId}`;await db`DELETE FROM question_sets WHERE id=${questionSetId}`;}
 if(student)await db`DELETE FROM students WHERE id=${student.id}`;await db.end();
}
