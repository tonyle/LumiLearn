import postgres from 'postgres';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
// Run in /app against a migrated local server. Every submission is rejected as blank before AI reservation.
const db=postgres(process.env.DATABASE_URL,{max:1}),origin=process.env.BOOKS_TEST_ORIGIN||'http://127.0.0.1:3000';
const students=[],tokens=[],activities=[],retainedImages=[];let parent,bookId,cp;
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '15 minutes')`;return 'lumi_session='+token;}
async function api(path,{method='GET',body,cookie=cp,site=origin}={}){const form=body instanceof FormData;const r=await fetch(origin+path,{method,headers:{cookie,origin:site,...(!form&&body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
function check(r,status,label){assert.equal(r.status,status,`${label}: ${JSON.stringify(r)}`);return r.data;}
try{
 [parent]=await db`INSERT INTO parents(email,display_name,password_hash) VALUES(${randomUUID()+'@activities-qa.invalid'},'Disposable activity QA','not-a-login-hash') RETURNING id`;cp=await session('parent',parent.id);
 for(let i=0;i<2;i++){const[s]=await db`INSERT INTO students(nickname,grade) VALUES(${'Disposable activity learner '+i},'1') RETURNING id`;students.push(s.id);}
 const ca=await session('student',students[0]),cb=await session('student',students[1]);
 const metadata={title:'Disposable activities '+randomUUID(),description:'Integration fixture',grade:'1'};
 bookId=check(await api('/api/parent/books',{method:'POST',body:metadata}),201,'book create').book.id;
 const parentBook='/api/parent/books/'+bookId,activityBase=parentBook+'/activities',studentBase='/api/books/'+bookId+'/activities';
 const jpeg=await sharp({create:{width:200,height:200,channels:3,background:'#ffffff'}}).jpeg().toBuffer(),form=new FormData();form.append('files',new Blob([jpeg],{type:'image/jpeg'}),'page.jpg');check(await api(parentBook+'/pages',{method:'POST',body:form}),200,'page upload');
 const page=check(await api(parentBook),200,'book detail').pages[0];
 const partId=randomUUID(),definition={title:'Draw the cat',instructions:'Draw the main character.',contextPageIds:[page.id],published:false,parts:[{id:partId,pageId:page.id,kind:'draw',label:'Character',x:0,y:0,width:.8,height:.8,lines:6,rubric:'PRIVATE_RUBRIC_CAT'}]};
 check(await api(activityBase,{method:'POST',body:definition}),422,'unreviewed context rejected');
 check(await api(parentBook+'/pages/'+page.id,{method:'PUT',body:{regions:[{id:randomUUID(),text:'The cat is happy.',x:.1,y:.1,width:.8,height:.2}],reviewed:true}}),200,'manual reviewed text');
 check(await api(parentBook,{method:'PATCH',body:{...metadata,published:true,studentIds:[students[0]]}}),200,'publish assigned book');
 let activity=check(await api(activityBase,{method:'POST',body:definition}),200,'create activity').activity;activities.push(activity.id);
 assert.equal(check(await api(studentBase,{cookie:ca}),200,'draft list').activities.length,0);
 check(await api(studentBase+'/'+activity.id,{cookie:ca}),404,'draft hidden');
 activity=check(await api(activityBase+'/'+activity.id,{method:'PATCH',body:{...definition,published:true,baseRevision:activity.revision}}),200,'publish activity').activity;
 const endpoint=studentBase+'/'+activity.id;
 check(await api(studentBase,{cookie:cb}),404,'unassigned list hidden');check(await api(endpoint,{cookie:cb}),404,'unassigned activity hidden');
 check(await api(activityBase,{cookie:ca}),403,'parent list protected');
 check(await api(endpoint+'?studentId='+students[1],{cookie:ca}),403,'student cannot read other history');
 const opened=check(await api(endpoint,{cookie:ca}),200,'student state');assert.equal(opened.state.revision,0);assert.ok(!JSON.stringify(opened).includes('PRIVATE_RUBRIC_CAT'));
 check(await api(endpoint,{method:'PUT',cookie:ca,site:'https://evil.example',body:{baseRevision:0,activityRevision:activity.revision,draft:{}}}),403,'origin guard');
 const saved=check(await api(endpoint,{method:'PUT',cookie:ca,body:{baseRevision:0,activityRevision:activity.revision,draft:{}}}),200,'blank autosave').state;
 check(await api(endpoint,{method:'PUT',cookie:ca,body:{baseRevision:0,activityRevision:activity.revision,draft:{}}}),409,'stale autosave');
 const ink=await sharp({create:{width:100,height:100,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
 const [before]=await db`SELECT count(*)::int count,coalesce(sum(reserved_cost_usd),0)::float8 cost FROM reading_book_activity_attempts WHERE activity_id=${activity.id}`;
 const blank=await api(endpoint,{method:'POST',cookie:ca,body:{key:randomUUID(),baseRevision:saved.revision,activityRevision:activity.revision,images:[{partId,png:'data:image/png;base64,'+ink.toString('base64')}]}});check(blank,422,'blank submit rejected');assert.equal(blank.error.code,'BLANK');
 const [after]=await db`SELECT count(*)::int count,coalesce(sum(reserved_cost_usd),0)::float8 cost FROM reading_book_activity_attempts WHERE activity_id=${activity.id}`;assert.deepEqual(after,before,'blank submit reserves no AI budget and creates no attempt');
 const work={[partId]:{text:'A happy cat',strokes:[]}};
 check(await api(endpoint,{method:'PUT',cookie:ca,body:{baseRevision:saved.revision,activityRevision:activity.revision,draft:work}}),200,'answer autosave');
 const attemptId=randomUUID(),results=[{partId,points:null,maximum:10,feedback:'Ask your parent to check.',transcription:'A happy cat',needsReview:true}];
 await db`INSERT INTO reading_book_activity_attempts(id,activity_id,student_id,state,draft,activity_snapshot,page_snapshot,results,maximum,reserved_cost_usd,submission_hash) VALUES(${attemptId},${activity.id},${students[0]},'needs_review',${db.json(work)},${db.json(activity)},${db.json([page])},${db.json(results)},10,0,'integration-fixture-no-ai')`;
 check(await api(endpoint,{method:'PATCH',cookie:ca,body:{studentId:students[0],attemptId,results:[{partId,points:8,feedback:'Nice cat!'}]}}),403,'student cannot review');
 const reviewed=check(await api(endpoint,{method:'PATCH',body:{studentId:students[0],attemptId,note:'PRIVATE_PARENT_NOTE',results:[{partId,points:8,feedback:'Nice cat!'}]}}),200,'parent review').state;
 assert.equal(reviewed.attempts[0].earned,8);assert.equal(reviewed.attempts[0].review.note,'PRIVATE_PARENT_NOTE');
 const snapshotImage=endpoint+'/attempts/'+attemptId+'/pages/'+page.id+'/image';assert.equal((await fetch(origin+snapshotImage,{headers:{cookie:cb}})).status,404,'unassigned snapshot image hidden');
 const child=check(await api(endpoint,{cookie:ca}),200,'student reviewed history');assert.ok(!JSON.stringify(child).includes('PRIVATE_PARENT_NOTE'));assert.ok(!JSON.stringify(child).includes('PRIVATE_RUBRIC_CAT'));assert.equal(child.state.attempts[0].earned,8);
 const replacement=randomUUID();activity=check(await api(activityBase+'/'+activity.id,{method:'PATCH',body:{...definition,published:true,parts:[{...definition.parts[0],id:replacement,label:'New area'}],baseRevision:activity.revision}}),200,'replace answer area').activity;
 const changed=check(await api(endpoint,{cookie:ca}),200,'compatible draft');assert.deepEqual(changed.state.draft,{});assert.equal(changed.state.attempts[0].draft[partId].text,'A happy cat');assert.equal(changed.state.attempts[0].activitySnapshot.parts[0].id,partId);
 retainedImages.push(page.image_key);check(await api(parentBook+'/pages/'+page.id,{method:'DELETE'}),200,'delete live source page');const preserved=await fetch(origin+snapshotImage,{headers:{cookie:cp}});assert.equal(preserved.status,200,'parent snapshot image survives source deletion');assert.ok((await preserved.arrayBuffer()).byteLength>0);
 check(await api(activityBase+'/'+activity.id,{method:'DELETE'}),200,'soft delete activity');check(await api(endpoint,{cookie:ca}),404,'deleted student activity hidden');
 const history=check(await api(endpoint+'?studentId='+students[0]),200,'parent deleted activity history');assert.equal(history.state.attempts[0].id,attemptId);assert.equal(history.state.attempts[0].review.note,'PRIVATE_PARENT_NOTE');
 const [immutable]=await db`SELECT results,activity_snapshot FROM reading_book_activity_attempts WHERE id=${attemptId}`;assert.equal(immutable.results[0].points,null);assert.equal(immutable.activity_snapshot.parts[0].id,partId);
 console.log('PASS book activities: migration/API, reviewed context, publication/assignment/auth/origin, private rubric and review-note isolation, optimistic autosave, blank submission before paid reservation, immutable attempts, parent review, compatible drafts, deletion/history. No paid AI calls.');
}finally{
 for(const id of activities){await db`DELETE FROM reading_book_activity_reviews WHERE attempt_id IN (SELECT id FROM reading_book_activity_attempts WHERE activity_id=${id})`;await db`DELETE FROM reading_book_activity_attempts WHERE activity_id=${id}`;await db`DELETE FROM reading_book_activity_states WHERE activity_id=${id}`;await db`DELETE FROM reading_book_activities WHERE id=${id}`;}
 if(bookId){const pages=await db`SELECT image_key FROM reading_book_pages WHERE book_id=${bookId}`;await db`DELETE FROM reading_books WHERE id=${bookId}`;for(const p of pages){assert.match(p.image_key,/^[a-f0-9-]+\.jpg$/i);await unlink(resolve('data/uploads/books',p.image_key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
 for(const key of retainedImages){assert.match(key,/^[a-f0-9-]+\.jpg$/i);await unlink(resolve('data/uploads/books',key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 for(const token of tokens)await db`DELETE FROM sessions WHERE token_hash=${token}`;
 for(const id of students)await db`DELETE FROM students WHERE id=${id}`;
 if(parent)await db`DELETE FROM parents WHERE id=${parent.id}`;await db.end();
}
