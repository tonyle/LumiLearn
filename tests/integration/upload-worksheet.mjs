import postgres from 'postgres';import {PDFDocument,StandardFonts} from 'pdf-lib';import {randomUUID,createHash} from 'node:crypto';import {unlink} from 'node:fs/promises';import {tsImport} from 'tsx/esm/api';import assert from 'node:assert/strict';
const {validateAuthorDraft}=await tsImport('/app/lib/worksheet-authoring.ts',import.meta.url);
const db=postgres(process.env.DATABASE_URL,{max:1});const tokens=[],uploads=[],assignments=[],sets=[];let learner;
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '10 minutes')`;return `lumi_session=${token}`;}
let auth;async function call(path,body,session=auth){const r=await fetch('http://127.0.0.1:3000'+path,{method:body?'POST':'GET',headers:{cookie:session,origin:'http://127.0.0.1:3000','content-type':'application/json','idempotency-key':randomUUID()},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
const pairs=[[1.2,3],[.4,2],[2.5,4],[.6,.7],[1.1,.8],[3.2,5],[.9,.3],[2.4,2],[.5,.5],[4.2,3]],expected=pairs.map(([a,b])=>Math.round(a*b*100)/100);
try{
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;auth=await session('parent',parent.id);[learner]=await db`INSERT INTO students(nickname,grade) VALUES('Disposable upload flow QA','5') RETURNING id`;const studentAuth=await session('student',learner.id);
 const pdf=await PDFDocument.create();const page=pdf.addPage([612,792]),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('Decimal Multiplication - Original QA Worksheet',{x:40,y:750,size:17,font});page.drawText('Find each product. Show your work. Grade 5 Mathematics.',{x:40,y:720,size:12,font});pairs.forEach(([a,b],i)=>page.drawText(`${i+1}. ${a} x ${b} = __________`,{x:55,y:680-i*55,size:15,font}));const bytes=await pdf.save();
 async function upload(){const form=new FormData();form.set('file',new File([bytes],'Disposable-decimal-worksheet.pdf',{type:'application/pdf'}));const r=await fetch('http://127.0.0.1:3000/api/parent/uploads',{method:'POST',headers:{cookie:auth},body:form}),data=await r.json();assert.equal(r.status,201,JSON.stringify(data));uploads.push(data.data.id);return data.data.id;}
 const id=await upload(),endpoint=`/api/parent/uploads/${id}/worksheets`;
 assert.equal((await call(endpoint,{grade:'5',subject:'math',mode:'ai'},studentAuth)).status,401);
 const res=await call(endpoint,{grade:'5',subject:'math',mode:'ai'});assert.equal(res.status,201,JSON.stringify(res));assert.equal(res.data.drafts.length,1);
 const again=await call(endpoint,{grade:'5',subject:'math',mode:'ai'});assert.equal(again.data.drafts[0].id,res.data.drafts[0].id);
 const [draft]=await db`SELECT * FROM worksheet_drafts WHERE id=${res.data.drafts[0].id}`;const parsed=validateAuthorDraft(draft.payload);assert.ok(parsed.success,JSON.stringify(parsed));assert.equal(parsed.data.questions.length,10);parsed.data.questions.forEach((q,i)=>{assert.equal(q.answer.kind,'number');assert.ok(Math.abs(q.answer.value-expected[i])<1e-9,`Question ${i+1} answer mismatch`);});
 const publish=`/api/parent/worksheets/${draft.id}/publish`;assert.equal((await call(publish,{baseRevision:1,studentIds:[learner.id]})).status,422);
 const assigned=await call(publish,{baseRevision:1,studentIds:[learner.id],reviewedSource:true});assert.equal(assigned.status,201,JSON.stringify(assigned));assignments.push(assigned.data.assignmentId);sets.push(assigned.data.questionSetId);
 const own=await call('/api/student/assignments/'+assignments[0],null,studentAuth);assert.equal(own.status,200);assert.ok(!JSON.stringify(own).includes('answer_key'));
 const questions=await db`SELECT qv.id,qv.answer_key FROM assignment_questions aq JOIN question_versions qv ON qv.id=aq.question_version_id WHERE aq.assignment_id=${assignments[0]} ORDER BY aq.sort_order`;
 const timer=await call(`/api/student/assignments/${assignments[0]}/timer`,{action:'start'},studentAuth);assert.equal(timer.status,200);
 const answerDraft=Object.fromEntries(questions.map(q=>[q.id,{text:String(q.answer_key.value),strokes:[]}]));const graded=await call(`/api/student/assignments/${assignments[0]}/pages/0`,{baseRevision:0,draft:answerDraft},studentAuth);assert.equal(graded.status,200,JSON.stringify(graded));assert.equal(graded.data.feedback.earned,100);
 const manualId=await upload();const manual=await call(`/api/parent/uploads/${manualId}/worksheets`,{grade:'3',subject:'science',mode:'manual'});assert.equal(manual.status,201);const [blank]=await db`SELECT payload FROM worksheet_drafts WHERE id=${manual.data.drafts[0].id}`;assert.equal(blank.payload.questions.length,10);assert.ok(blank.payload.questions.every(q=>!q.text));
 console.log('Upload integration passed: real OpenAI PDF extraction, all ten answer keys checked, idempotent read, required parent review, Assign to disposable student, student access, whole-page 100/100 submission, manual fallback and role protection.');
}finally{
 for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;
 for(const id of uploads){const [row]=await db`SELECT private_storage_key FROM uploads WHERE id=${id}`;await db`DELETE FROM worksheet_drafts WHERE upload_id=${id}`;await db`DELETE FROM uploads WHERE id=${id}`;if(row)await unlink('/app/data/uploads/'+row.private_storage_key).catch(()=>{});}
 for(const id of assignments){await db`DELETE FROM audit_events WHERE entity_id=${id}`;await db`DELETE FROM assignments WHERE id=${id}`;}
 for(const id of sets){await db`DELETE FROM question_versions WHERE question_id IN (SELECT id FROM questions WHERE set_id=${id})`;await db`DELETE FROM questions WHERE set_id=${id}`;await db`DELETE FROM question_sets WHERE id=${id}`;}
 if(learner)await db`DELETE FROM students WHERE id=${learner.id}`;await db.end();
}
