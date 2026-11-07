import postgres from 'postgres';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
const db=postgres(process.env.DATABASE_URL,{max:1}),origin='http://127.0.0.1:3000',tokens=[];let parent,student,book;
async function session(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '15 minutes')`;return 'lumi_session='+token;}
try{
 [parent]=await db`INSERT INTO parents(email,display_name,password_hash) VALUES(${randomUUID()+'@prepared-audio.invalid'},'Prepared audio QA','not-a-login-hash') RETURNING id`;
 [student]=await db`INSERT INTO students(nickname,grade) VALUES('Prepared audio QA','1') RETURNING id`;
 [book]=await db`INSERT INTO reading_books(title,grade,published,created_by) VALUES('Prepared audio QA','1',true,${parent.id}) RETURNING id`;
 const regions=[{id:randomUUID(),text:'The little bird can fly.',x:.1,y:.1,width:.8,height:.2}],pc=await session('parent',parent.id),sc=await session('student',student.id);
 const [page]=await db`INSERT INTO reading_book_pages(book_id,page_number,image_key,width,height,regions,reviewed) VALUES(${book.id},1,${randomUUID()+'.jpg'},100,100,${db.json(regions)},true) RETURNING id`;
 await db`INSERT INTO reading_book_students(book_id,student_id) VALUES(${book.id},${student.id})`;
 const endpoint='/api/parent/books/'+book.id+'/audio',audio=`/api/books/${book.id}/listen?pageId=${page.id}&regionId=${regions[0].id}`;
 assert.equal((await fetch(origin+endpoint,{headers:{cookie:sc}})).status,403);
 assert.equal((await fetch(origin+endpoint,{method:'POST',headers:{cookie:pc,origin:'https://evil.example'}})).status,403);
 const first=await fetch(origin+audio,{headers:{cookie:sc}});assert.ok([200,409].includes(first.status));
 assert.equal((await fetch(origin+endpoint,{method:'POST',headers:{cookie:pc,origin}})).status,200);
 const wait=async()=>{for(let i=0;i<150;i++){const r=await fetch(origin+endpoint,{headers:{cookie:pc}}),j=await r.json();assert.equal(r.status,200);if(j.data.state==='ready')return j.data;await new Promise(resolve=>setTimeout(resolve,1000));}throw Error('Background audio did not become ready');};
 const ready=await wait();assert.equal(ready.total,1);assert.equal(ready.ready,1);
 const timings=[],copies=[];for(const speed of [.65,.85,1]){const at=performance.now(),r=await fetch(origin+audio+'&speed='+speed,{headers:{cookie:sc}});assert.equal(r.status,200);assert.equal(r.headers.get('x-book-audio'),'prepared');const bytes=Buffer.from(await r.arrayBuffer());timings.push(Math.round(performance.now()-at));copies.push(bytes);assert.ok(bytes.length>44);}
 assert.deepEqual(copies[0],copies[2],'one master supports all playback rates');
 const range=await fetch(origin+audio,{headers:{cookie:sc,range:'bytes=0-43'}});assert.equal(range.status,206);
 await db`UPDATE reading_book_pages SET regions=${db.json([{...regions[0],text:'The happy bird sings.'}])} WHERE id=${page.id}`;await db`UPDATE reading_books SET revision=revision+1,updated_at=now() WHERE id=${book.id}`;
 const changed=await fetch(origin+audio,{headers:{cookie:sc}});if(changed.status===200)assert.notDeepEqual(Buffer.from(await changed.arrayBuffer()),copies[0],'edited text must not play old audio');else assert.equal(changed.status,409);await wait();assert.equal((await fetch(origin+audio,{headers:{cookie:sc}})).status,200);
 console.log(JSON.stringify({passed:true,checks:'Compose worker auto-discovery, durable permanent master, preparation progress/auth/origin, immediate file-only playback at three rates, byte range and text edit invalidation/regeneration',playbackMs:timings}));
}finally{
 for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;
 if(book){await db`DELETE FROM reading_books WHERE id=${book.id}`;await rm(join('/app/data/uploads/books/audio',book.id),{recursive:true,force:true});}
 if(student)await db`DELETE FROM students WHERE id=${student.id}`;
 if(parent)await db`DELETE FROM parents WHERE id=${parent.id}`;
 await db.end();
}
