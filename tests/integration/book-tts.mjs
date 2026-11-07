import postgres from 'postgres';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {unlink,writeFile,mkdir,rm} from 'node:fs/promises';
import sharp from 'sharp';
const db=postgres(process.env.DATABASE_URL,{max:1}),origin=process.env.BOOKS_TEST_ORIGIN||'http://127.0.0.1:3000';
const tokens=[],students=[];let parent,book,image;
async function auth(role,id){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${hash},now()+interval '15 minutes')`;return `lumi_session=${token}`;}
try{
 [parent]=await db`INSERT INTO parents(email,display_name,password_hash) VALUES(${randomUUID()+'@tts-qa.invalid'},'Disposable TTS QA','not-a-login-hash') RETURNING id`;
 for(let i=0;i<2;i++){const [s]=await db`INSERT INTO students(nickname,grade) VALUES(${'TTS QA '+i},'1') RETURNING id`;students.push(s.id);}
 const cookie=await auth('student',students[0]),other=await auth('student',students[1]);
 [book]=await db`INSERT INTO reading_books(title,grade,published,created_by) VALUES('TTS QA book','1',true,${parent.id}) RETURNING id`;
 image=randomUUID()+'.jpg';await mkdir('/app/data/uploads/books',{recursive:true});await writeFile('/app/data/uploads/books/'+image,await sharp({create:{width:100,height:100,channels:3,background:'#ffffff'}}).jpeg().toBuffer());
 const regionId=randomUUID(),text='The little bird can fly. It flies up to the sky.';
 const [page]=await db`INSERT INTO reading_book_pages(book_id,page_number,image_key,width,height,regions,reviewed) VALUES(${book.id},1,${image},100,100,${db.json([{id:regionId,text,x:.1,y:.1,width:.8,height:.2}])},true) RETURNING id`;
 await db`INSERT INTO reading_book_students(book_id,student_id) VALUES(${book.id},${students[0]})`;
 const path=`/api/books/${book.id}/listen?pageId=${page.id}&regionId=${regionId}&voice=af_heart&speed=0.65`;
 const listen=(extra='',who=cookie,headers={})=>fetch(origin+path+extra,{headers:{cookie:who,...headers}});
 assert.equal((await listen('', '')).status,401,'anonymous');assert.equal((await listen('',other)).status,404,'unassigned');assert.equal((await listen('&text=Injected')).status,422,'no arbitrary text');assert.equal((await listen('',cookie,{origin:'https://evil.example'})).status,403,'origin');
 const parentCookie=await auth('parent',parent.id),deadline=Date.now()+180000;for(;;){const status=await fetch(origin+`/api/parent/books/${book.id}/audio`,{headers:{cookie:parentCookie}});const ready=await status.json();if(ready.data?.state==='ready')break;if(Date.now()>deadline)throw Error('Prepared audio timeout');await new Promise(resolve=>setTimeout(resolve,1000));}
 const first=await listen();assert.equal(first.status,200,await first.clone().text());assert.equal(first.headers.get('content-type'),'audio/wav');const audio=Buffer.from(await first.arrayBuffer());assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');assert.equal(audio.readUInt32LE(24),24000);assert.equal(audio.readUInt16LE(34),16);assert.ok(audio.length>48000);
 const repeat=await listen();assert.equal(repeat.headers.get('x-tts-cache'),'HIT');assert.deepEqual(Buffer.from(await repeat.arrayBuffer()),audio,'same cached bytes');
 const range=await listen('',cookie,{range:'bytes=0-43'});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,44);assert.equal((await listen('',cookie,{range:'bytes=999999999-'})).status,416);
 const normal=await listen('&speed=1');assert.equal(normal.status,200);assert.equal((await normal.arrayBuffer()).byteLength,audio.length,'native playback rate reuses the master');
 await db`UPDATE reading_book_pages SET reviewed=false WHERE id=${page.id}`;assert.equal((await listen()).status,404,'review invalidated even on cache hit');await db`UPDATE reading_book_pages SET reviewed=true WHERE id=${page.id}`;
 await db`DELETE FROM reading_book_students WHERE book_id=${book.id}`;assert.equal((await listen()).status,404,'revoked access even on cache hit');
 console.log(JSON.stringify({passed:true,checks:'Kokoro af_heart real WAV 24kHz PCM16, slow/normal, cache equality, Safari byte ranges, anonymous/unassigned/origin/input/review/revocation guards',audioBytes:audio.length,firstCache:first.headers.get('x-tts-cache')}));
}finally{
 for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;
 if(book){await db`DELETE FROM reading_books WHERE id=${book.id}`;await rm('/app/data/uploads/books/audio/'+book.id,{recursive:true,force:true});}
 for(const id of students)await db`DELETE FROM students WHERE id=${id}`;
 if(parent)await db`DELETE FROM parents WHERE id=${parent.id}`;
 if(image)await unlink('/app/data/uploads/books/'+image).catch(()=>{});
 await db.end();
}
