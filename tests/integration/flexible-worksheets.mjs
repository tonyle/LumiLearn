import {unlink} from 'node:fs/promises';import {PDFDocument} from 'pdf-lib';
import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {tsImport} from 'tsx/esm/api';
const {emptyAuthorDraft,emptyAuthorQuestion}=await tsImport('/app/lib/worksheet-authoring.ts',import.meta.url);
const db=postgres(process.env.DATABASE_URL,{max:1}),students=[],tokens=[],drafts=[],assignments=[],sets=[],batches=[],uploads=[];let auth,studentAuth;
async function session(role,id){const token=randomUUID(),digest=createHash('sha256').update(token).digest('hex');tokens.push(digest);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${digest},now()+interval '15 minutes')`;return 'lumi_session='+token;}
async function req(path,body,cookie=auth,method=body?'POST':'GET'){const r=await fetch('http://127.0.0.1:3000'+path,{method,headers:{cookie,origin:'http://127.0.0.1:3000','content-type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;auth=await session('parent',parent.id);const [student]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable flexible QA','3') RETURNING id`;students.push(student.id);studentAuth=await session('student',student.id);
 for(const count of [1,7,13,23]){
  const draft=emptyAuthorDraft();draft.title='Disposable flexible '+count;draft.questions=Array.from({length:count},(_,i)=>({...emptyAuthorQuestion(i),text:`Calculate ${i} + 2.`,numberValue:String(i+2)}));
  const saved=await req('/api/parent/worksheets',{creationKey:randomUUID().replaceAll('-',''),draft});assert.equal(saved.status,201,JSON.stringify(saved));drafts.push(saved.data.id);
  const published=await req(`/api/parent/worksheets/${saved.data.id}/publish`,{baseRevision:1,studentIds:[student.id]});assert.equal(published.status,201,JSON.stringify(published));assignments.push(published.data.assignmentId);sets.push(published.data.questionSetId);
  const assignmentId=published.data.assignmentId,rows=await db`SELECT question_version_id FROM assignment_questions WHERE assignment_id=${assignmentId} ORDER BY sort_order`;assert.equal(rows.length,count);
  assert.equal((await req(`/api/parent/assignments/${assignmentId}/students`,{studentIds:[student.id]})).status,200);
  const studentView=await req(`/api/student/assignments/${assignmentId}`,undefined,studentAuth);assert.equal(studentView.status,200);assert.ok(!JSON.stringify(studentView).includes('answer_key'));
  const pdf=await fetch(`http://127.0.0.1:3000/api/assignments/${assignmentId}/pdf`,{headers:{cookie:auth}});assert.equal(pdf.status,200);assert.ok((await pdf.arrayBuffer()).byteLength>1000);
  if(count===13){
   const qs=await db`SELECT qv.id,qv.answer_key FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id WHERE aq.assignment_id=${assignmentId} ORDER BY aq.sort_order`;
   // Two different pages graded once must not complete a non-perfect worksheet.
   for(let page=0;page<2;page++){
    assert.equal((await req(`/api/student/assignments/${assignmentId}/timer`,{action:'resume'},studentAuth)).status,200);
    const answers=Object.fromEntries(qs.slice(page*10,page*10+10).map(q=>[q.id,{text:'999',strokes:[]}]));const result=await req(`/api/student/assignments/${assignmentId}/pages/${page}`,{baseRevision:0,draft:answers},studentAuth);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.completed,false);assert.equal(result.data.gradingAttempts,1);assert.equal(result.data.feedback.maximum,page===0?100:30);
   }
   // A perfect second submission on every page completes and pays only one worksheet reward.
   for(let page=0;page<2;page++){
    await req(`/api/student/assignments/${assignmentId}/timer`,{action:'resume'},studentAuth);const current=await req(`/api/student/assignments/${assignmentId}/pages/${page}`,undefined,studentAuth);
    const answers=Object.fromEntries(qs.slice(page*10,page*10+10).map(q=>[q.id,{text:String(q.answer_key.value),strokes:[]}]));const result=await req(`/api/student/assignments/${assignmentId}/pages/${page}`,{baseRevision:current.data.revision,draft:answers},studentAuth);assert.equal(result.status,200);assert.equal(result.data.completed,page===1);assert.equal(result.data.gradingAttempts,2);
   }
   const wallet=await req('/api/student/games',undefined,studentAuth);assert.equal(wallet.data.wallet.points,3);
   const reopened=await req(`/api/parent/assignments/${assignmentId}/reopen`,{studentId:student.id});assert.equal(reopened.status,200);for(let page=0;page<2;page++){const p=await req(`/api/student/assignments/${assignmentId}/pages/${page}`,undefined,studentAuth);assert.equal(p.data.completed,false);assert.equal(p.data.gradingAttempts,0);}
  }
  if(count===7){const library=await req('/api/parent/assignments',{title:'Disposable seven from library',questionVersionIds:rows.map(r=>r.question_version_id),studentIds:[student.id],creationKey:randomUUID().replaceAll('-','')});assert.equal(library.status,201,JSON.stringify(library));assignments.push(library.data.assignmentId);}
 }
 const parameters={grade:'3',subject:'math',topic:'Adding small numbers',count:1,questionCount:7,difficulty:'grade_level',instructions:''};
 const batch=await req('/api/parent/generate',{creationKey:randomUUID().replaceAll('-',''),parameters});assert.equal(batch.status,201);batches.push(batch.data.id);assert.equal((await req('/api/parent/generate/'+batch.data.id)).data.parameters.questionCount,7);
 const pdfSource=await PDFDocument.create();pdfSource.addPage();const form=new FormData();form.set('file',new File([await pdfSource.save()],'disposable-reference.pdf',{type:'application/pdf'}));const uploadedResponse=await fetch('http://127.0.0.1:3000/api/parent/uploads',{method:'POST',headers:{cookie:auth,origin:'http://127.0.0.1:3000'},body:form});const uploaded=await uploadedResponse.json();assert.equal(uploadedResponse.status,201);uploads.push(uploaded.data.id);
 const withReference=await req('/api/parent/generate',{creationKey:randomUUID().replaceAll('-',''),parameters:{...parameters,referenceUploadId:uploaded.data.id}});assert.equal(withReference.status,201);batches.push(withReference.data.id);assert.equal((await req('/api/parent/generate/'+withReference.data.id)).data.parameters.referenceUploadId,uploaded.data.id);
 const unavailable=await req('/api/parent/generate',{creationKey:randomUUID().replaceAll('-',''),parameters:{...parameters,referenceUploadId:randomUUID()}});assert.equal(unavailable.status,404);
 assert.equal((await req('/api/parent/generate',{creationKey:randomUUID().replaceAll('-',''),parameters:{...parameters,questionCount:0}})).status,422);
 console.log('PASS flexible worksheets: 1/7/13/23 manual publish, library7, student privacy/ownership, PDFs, 13-question partial last page, per-page attempts/completion/reopen, percentage rewards, custom AI count batch metadata/reference validation. No paid AI calls.');
}finally{
 for(const id of batches)await db`DELETE FROM worksheet_generation_batches WHERE id=${id}`;
 for(const id of uploads){const [u]=await db`DELETE FROM uploads WHERE id=${id} RETURNING private_storage_key`;if(u)await unlink('/app/data/uploads/'+u.private_storage_key);}
 for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;
 for(const id of drafts)await db`DELETE FROM worksheet_drafts WHERE id=${id}`;
 for(const id of students)await db`DELETE FROM students WHERE id=${id}`;
 for(const id of assignments)await db`DELETE FROM assignments WHERE id=${id}`;
 for(const id of sets){await db`DELETE FROM question_versions WHERE question_id IN (SELECT id FROM questions WHERE set_id=${id})`;await db`DELETE FROM questions WHERE set_id=${id}`;await db`DELETE FROM question_sets WHERE id=${id}`;}await db.end();
}
