import postgres from 'postgres';import {hash} from '@node-rs/argon2';import{randomUUID,createHash}from'node:crypto';import assert from'node:assert/strict';
const db=postgres(process.env.DATABASE_URL),origin='http://127.0.0.1:3000';let parent,student,other;
async function session(role,id){const t=randomUUID();await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?id:null},${role==='student'?id:null},${createHash('sha256').update(t).digest('hex')},now()+interval '10 minutes')`;return'lumi_session='+t;}
async function api(path,cookie,body,site=origin){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{cookie,origin:site,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:r.status,...await r.json()};}
try{
 [parent]=await db`INSERT INTO parents(email,display_name,password_hash) VALUES(${randomUUID()+'@schedule.invalid'},'Schedule QA',${await hash(randomUUID())}) RETURNING id`;
 [student]=await db`INSERT INTO students(nickname,grade) VALUES('Schedule QA','1') RETURNING id`;[other]=await db`INSERT INTO students(nickname,grade) VALUES('Other Schedule QA','3') RETURNING id`;
 const cp=await session('parent',parent.id),cs=await session('student',student.id),co=await session('student',other.id),base='/api/student/games',settings='/api/parent/games/'+student.id;
 const initial=(await api(base,cs)).data.wallet;assert.deepEqual(initial.allowed_days,[1,2,3,4,5,6,7]);assert.equal(initial.schedule_allowed,true);
 const change=(days)=>({key:randomUUID(),points:0,note:'Disposable schedule verification',enabled:true,rewardPoints:3,secondsPerPoint:60,dailyLimitMinutes:30,allowedDays:days});
 await db`UPDATE game_wallets SET points=10,seconds=180 WHERE student_id=${student.id}`;
 const run=await api(base+'/start',cs,{key:randomUUID()});assert.equal(run.status,200,JSON.stringify(run));
 const [boundary]=await db`SELECT (((now() AT TIME ZONE 'America/Chicago')::date+1)::timestamp AT TIME ZONE 'America/Chicago') midnight`;
 assert.ok(new Date(run.data.expiresAt)<=new Date(boundary.midnight));
 assert.equal((await api(settings,cs,change([]))).status,403);assert.equal((await api(settings,cp,change([]),'https://evil.example')).status,403);
 for(const days of [[0],[8],[1,1]])assert.equal((await api(settings,cp,change(days))).status,422);
 const closed=await api(settings,cp,change([]));assert.equal(closed.status,200,JSON.stringify(closed));assert.equal(closed.data.schedule_allowed,false);assert.equal(closed.data.active,null);assert.equal(closed.data.points,10);assert.ok(closed.data.seconds>=178);
 for(const game of ['flappy','dash','math20','mathfacts','magic','ttt']){const r=await api(base+'/start',cs,{key:randomUUID(),game});assert.equal(r.status,403,game+JSON.stringify(r));assert.equal(r.error.code,'SCHEDULE');}
 assert.equal((await api(base+'/start',cs,{key:run.data.request_key||randomUUID()})).status,403);
 assert.equal((await api(base+'/exchange',cs,{points:1,key:randomUUID()})).status,403);assert.equal((await api(base,cs)).data.wallet.points,10);
 assert.equal((await api(base,co)).data.wallet.schedule_allowed,true);
 const weekend=await api(settings,cp,change([6,7]));assert.deepEqual(weekend.data.allowed_days,[6,7]);
 await api(settings,cp,change([1,2,3,4,5,6,7]));const opened=await api(base+'/start',cs,{key:randomUUID(),game:'ttt',level:1});assert.equal(opened.status,200,JSON.stringify(opened));
 console.log('PASS: per-student weekly schedules, defaults, validation, parent/origin guard, all six game starts and exchange blocked, active run stopped/refunded, independent student and midnight cap.');
}finally{for(const s of [student,other])if(s){await db`DELETE FROM game_ledger WHERE student_id=${s.id}`;await db`DELETE FROM students WHERE id=${s.id}`;}if(parent){await db`DELETE FROM parents WHERE id=${parent.id}`;}await db.end();}
