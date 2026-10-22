import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {tsImport} from 'tsx/esm/api';
const {emptyAuthorDraft}=await tsImport('/app/lib/worksheet-authoring.ts',import.meta.url);
const db=postgres(process.env.DATABASE_URL,{max:1});const students=[],tokens=[],drafts=[],assignments=[],sets=[];
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '10 minutes')`;return `lumi_session=${token}`;}
let auth;async function req(path,method='POST',body,cookie=auth,origin='http://127.0.0.1:3000'){const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();return {status:r.status,...data};}
try{const [parent]=await db`SELECT id FROM parents LIMIT 1`;auth=await session('parent',parent.id);for(let i=0;i<2;i++){const [s]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable worksheet QA','3') RETURNING id`;students.push(s.id);}
const draft=emptyAuthorDraft();draft.title='Disposable manual worksheet';draft.questions.forEach((q,i)=>{q.text=`What is ${i} + 1?`;q.numberValue=String(i+1);});
const creationKey=randomUUID().replaceAll('-','');const saved=await req('/api/parent/worksheets','POST',{creationKey,draft});assert.equal(saved.status,201,JSON.stringify(saved));drafts.push(saved.data.id);const id=saved.data.id;
const repeated=await req('/api/parent/worksheets','POST',{creationKey,draft});assert.equal(repeated.data.id,id);
assert.equal((await req('/api/parent/worksheets/'+id,'PATCH',{baseRevision:99,draft})).status,409);
assert.equal((await req('/api/parent/worksheets/'+id+'/publish','POST',{baseRevision:1,studentIds:[]})).status,422);
assert.equal((await req('/api/parent/worksheets/'+id+'/publish','POST',{baseRevision:1,studentIds:[students[0]]},auth,'https://evil.example')).status,403);
const published=await req('/api/parent/worksheets/'+id+'/publish','POST',{baseRevision:1,studentIds:[students[0]]});assert.equal(published.status,201,JSON.stringify(published));assignments.push(published.data.assignmentId);sets.push(published.data.questionSetId);
assert.equal((await db`SELECT * FROM assignment_questions WHERE assignment_id=${assignments[0]}`).length,10);
assert.equal((await req('/api/parent/worksheets/'+id,'PATCH',{baseRevision:1,draft})).status,409);
assert.equal((await req('/api/parent/worksheets/'+id+'/publish','POST',{baseRevision:1,studentIds:[students[0]]})).data.assignmentId,assignments[0]);
assert.equal((await req('/api/parent/worksheets/'+id+'/publish','POST',{baseRevision:1,studentIds:[students[1]]})).status,409);
const studentAuth=await session('student',students[0]),otherAuth=await session('student',students[1]);
const own=await req('/api/student/assignments/'+assignments[0],'GET',null,studentAuth);assert.equal(own.status,200);assert.ok(!JSON.stringify(own).includes('answer_key'));assert.ok(!JSON.stringify(own).includes('parentExplanation'));
assert.equal((await req('/api/student/assignments/'+assignments[0],'GET',null,otherAuth)).status,404);
assert.equal((await req('/api/parent/worksheets','POST',{creationKey:randomUUID().replaceAll('-',''),draft},studentAuth)).status,401);
const add=await req('/api/parent/assignments/'+assignments[0]+'/students','POST',{studentIds:students});assert.equal(add.status,200,JSON.stringify(add));assert.equal((await db`SELECT * FROM assignment_students WHERE assignment_id=${assignments[0]}`).length,2);
await req('/api/parent/assignments/'+assignments[0]+'/students','POST',{studentIds:students});assert.equal((await db`SELECT * FROM assignment_students WHERE assignment_id=${assignments[0]}`).length,2);
assert.equal((await req('/api/student/assignments/'+assignments[0],'GET',null,otherAuth)).status,200);
const versions=await db`SELECT question_version_id FROM assignment_questions WHERE assignment_id=${assignments[0]} ORDER BY sort_order`;
const libraryBody={title:'Disposable library worksheet',questionVersionIds:versions.map(q=>q.question_version_id),studentIds:[students[0]],creationKey:randomUUID().replaceAll('-','')};
assert.equal((await req('/api/parent/assignments','POST',{...libraryBody,questionVersionIds:libraryBody.questionVersionIds.slice(1)})).status,422);
const library=await req('/api/parent/assignments','POST',libraryBody);assert.equal(library.status,201,JSON.stringify(library));assignments.push(library.data.assignmentId);assert.equal((await req('/api/parent/assignments','POST',libraryBody)).data.assignmentId,library.data.assignmentId);
console.log('Worksheet integration passed: draft idempotency, revision conflict, exact 10, origin/role protection, atomic publish, immutable published content, private keys, student ownership, append students, library assignment and retry.');
}finally{for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;for(const id of drafts)await db`DELETE FROM worksheet_drafts WHERE id=${id}`;for(const id of assignments)await db`DELETE FROM assignments WHERE id=${id}`;for(const id of sets){await db`DELETE FROM question_versions WHERE question_id IN (SELECT id FROM questions WHERE set_id=${id})`;await db`DELETE FROM questions WHERE set_id=${id}`;await db`DELETE FROM question_sets WHERE id=${id}`;}for(const id of students)await db`DELETE FROM students WHERE id=${id}`;await db.end();}
