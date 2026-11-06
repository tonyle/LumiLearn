import postgres from 'postgres';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

// Run inside the deployed app container, with its DATABASE_URL and upload volume.
const db=postgres(process.env.DATABASE_URL,{max:1});
const origin=process.env.BOOKS_TEST_ORIGIN||'http://127.0.0.1:3000';
const students=[],books=[],tokens=[];let parent,cp;
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '15 minutes')`;return 'lumi_session='+token;}
async function api(path,{method='GET',body,cookie=cp,site=origin}={}){const form=body instanceof FormData;const response=await fetch(origin+path,{method,headers:{cookie,origin:site,...(!form&&body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});const text=await response.text();let result;try{result=JSON.parse(text);}catch{result={raw:text};}return {status:response.status,...result};}
function check(result,status,label){assert.equal(result.status,status,`${label}: ${JSON.stringify(result)}`);return result.data;}
const forbidden=result=>assert.ok([403,404].includes(result.status),JSON.stringify(result));
try{
 [parent]=await db`INSERT INTO parents(email,display_name,password_hash) VALUES(${randomUUID()+'@books-qa.invalid'},'Disposable books QA','not-a-login-hash') RETURNING id`;
 cp=await session('parent',parent.id);
 for(let i=0;i<2;i++){const[s]=await db`INSERT INTO students(nickname,grade) VALUES(${'Disposable books learner '+i},'1') RETURNING id`;students.push(s.id);}
 const ca=await session('student',students[0]),cb=await session('student',students[1]);
 const metadata={title:'Disposable reading book '+randomUUID(),description:'Integration fixture',grade:'1'};
 check(await api('/api/parent/books',{method:'POST',body:metadata,cookie:ca}),403,'student cannot create');
 check(await api('/api/parent/books',{method:'POST',body:metadata,site:'https://evil.example'}),403,'cross-origin create');
 const created=check(await api('/api/parent/books',{method:'POST',body:metadata}),201,'create');
 const id=created.book.id;books.push(id);const base='/api/parent/books/'+id;
 const settings=(studentIds,published=true)=>({...metadata,published,studentIds});
 check(await api(base,{method:'PATCH',body:settings(students)}),409,'empty book cannot publish');
 const jpeg=await sharp({create:{width:100,height:100,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
 const bad=new FormData();bad.append('files',new Blob(['not an image'],{type:'text/plain'}),'bad.txt');
 assert.ok([400,415,422].includes((await api(base+'/pages',{method:'POST',body:bad})).status),'invalid MIME rejected');
 const form=new FormData();form.append('files',new Blob([jpeg],{type:'image/jpeg'}),'page.jpg');
 check(await api(base+'/pages',{method:'POST',body:form}),200,'upload');
 let detail=check(await api(base),200,'parent detail');assert.ok(detail.book);assert.ok(Array.isArray(detail.pages));assert.deepEqual(detail.studentIds,[]);assert.equal(detail.pages.length,1);
 const page=detail.pages[0],pageBase=base+'/pages/'+page.id,image='/api/books/'+id+'/pages/'+page.id+'/image';
 check(await api(base,{method:'PATCH',body:settings(students)}),409,'unreviewed book cannot publish');
 const region={id:randomUUID(),text:'The cat is happy.',x:.1,y:.1,width:.8,height:.2};
 const invalid=await api(pageBase,{method:'PUT',body:{regions:[{...region,x:.9,width:.8}],reviewed:true}});assert.ok([400,422].includes(invalid.status),JSON.stringify(invalid));
 check(await api(pageBase,{method:'PUT',body:{regions:[region],reviewed:true}}),200,'manual review');
 check(await api(base,{method:'PATCH',body:settings([students[0]])}),200,'publish and assign');
 const imageResponse=await fetch(origin+image,{headers:{cookie:ca}});assert.equal(imageResponse.status,200);assert.match(imageResponse.headers.get('content-type'),/image\/jpeg/);assert.ok((await imageResponse.arrayBuffer()).byteLength>0);
 forbidden(await api(image,{cookie:cb}));
 forbidden(await api('/api/books/'+id+'/translate',{method:'POST',body:{pageId:page.id,regionId:region.id},cookie:cb}));
 const audio=new FormData();audio.append('pageId',page.id);audio.append('regionId',region.id);audio.append('audio',new Blob(['deliberately invalid; authorization must happen first'],{type:'audio/webm'}),'recording.webm');
 forbidden(await api('/api/books/'+id+'/read-aloud',{method:'POST',body:audio,cookie:cb}));
 check(await api(base,{method:'PATCH',body:settings([])}),200,'unassign');forbidden(await api(image,{cookie:ca}));
 check(await api(base,{method:'PATCH',body:settings([students[0]])}),200,'reassign');
 check(await api(pageBase,{method:'PUT',body:{regions:[{...region,text:'The dog is happy.'}],reviewed:true}}),200,'edit page');
 detail=check(await api(base),200,'edited detail');assert.equal(detail.book.published,false,'page edit unpublishes');forbidden(await api(image,{cookie:ca}));
 check(await api(base,{method:'PATCH',body:settings([students[0]])}),200,'republish');
 check(await api(base,{method:'DELETE'}),200,'soft delete');check(await api(base),404,'deleted parent detail');forbidden(await api(image,{cookie:ca}));
 const[row]=await db`SELECT deleted_at FROM reading_books WHERE id=${id}`;assert.ok(row.deleted_at,'soft deletion retains database row');
 console.log('PASS books: disposable create/upload/manual review, validation, publishing, assignment/image isolation, service authorization, revocation, edit unpublishing, soft deletion and origin guards. No AI/service calls.');
}finally{
 for(const id of books){const pages=await db`SELECT image_key FROM reading_book_pages WHERE book_id=${id}`;await db`DELETE FROM reading_books WHERE id=${id}`;for(const page of pages){assert.match(page.image_key,/^[a-f0-9-]+\.jpg$/i);await unlink(resolve('data/uploads/books',page.image_key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
 for(const token of tokens)await db`DELETE FROM sessions WHERE token_hash=${token}`;
 for(const id of students)await db`DELETE FROM students WHERE id=${id}`;
 if(parent)await db`DELETE FROM parents WHERE id=${parent.id}`;
 await db.end();
}
