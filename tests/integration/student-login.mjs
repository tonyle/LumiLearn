import {request as httpRequest} from 'node:http';import postgres from 'postgres';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
const db=postgres(process.env.DATABASE_URL,{max:1}),base='http://127.0.0.1:3000';let id;const name='qa-'+randomUUID().slice(0,8);let parentHash;
async function post(path,body,cookie,method='POST',extraHeaders={}){return new Promise((resolve,reject)=>{const payload=JSON.stringify(body);const req=httpRequest(base+path,{method,headers:{'content-type':'application/json','content-length':Buffer.byteLength(payload),...extraHeaders,...(cookie?{cookie}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.entries(res.headers).flatMap(([key,value])=>Array.isArray(value)?value.map(v=>[key,v]):value?[[key,value]]:[])})));});req.on('error',reject);req.end(payload);});}
try{
 const [s]=await db`INSERT INTO students(nickname,grade,login_name) VALUES('Disposable login QA','3',${name}) RETURNING id`;id=s.id;
 assert.equal((await post('/api/auth/student/select',{studentId:id})).status,401);
 assert.equal((await post('/api/auth/student/login',{loginName:name,pin:'123456'})).status,401);
 const [parent]=await db`SELECT id FROM parents LIMIT 1`;const token=randomUUID();parentHash=createHash('sha256').update(token).digest('hex');await db`INSERT INTO sessions(role,parent_id,token_hash,expires_at) VALUES('parent',${parent.id},${parentHash},now()+interval '5 minutes')`;
 assert.equal((await post(`/api/parent/students/${id}`,{loginName:name,pin:'123456'},`lumi_session=${token}`,'PATCH')).status,200);
 assert.equal((await post(`/api/parent/students/${id}`,{loginName:name,pin:'123456'},`lumi_session=${token}`,'PATCH',{host:'192.168.1.16:3000',origin:'http://192.168.1.16:3000'})).status,200);
 assert.equal((await post(`/api/parent/students/${id}`,{loginName:name,pin:'123456'},`lumi_session=${token}`,'PATCH',{origin:'http://untrusted.example'})).status,403);
 const [stored]=await db`SELECT pin_hash FROM students WHERE id=${id}`;assert.notEqual(stored.pin_hash,'123456');assert.ok(stored.pin_hash.startsWith('$argon2'));
 assert.equal((await post('/api/auth/student/login',{loginName:name,pin:'000000'})).status,401);
 const login=await post('/api/auth/student/login',{loginName:name,pin:'123456'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
 const home=await fetch(base+`/s/${id}/home`,{headers:{cookie}});assert.equal(home.status,200);assert.ok((await home.text()).includes('Disposable login QA'));
 const history=await fetch(base+`/s/${id}/history?date=2026-02-30`,{headers:{cookie}});assert.equal(history.status,200);assert.ok((await history.text()).includes('A fresh page.'));
 const [other]=await db`SELECT id FROM students WHERE id<>${id} LIMIT 1`;const denied=await fetch(base+`/s/${other.id}/history`,{headers:{cookie},redirect:'manual'});assert.equal(denied.status,307);
 assert.equal((await post(`/api/parent/students/${id}`,{loginName:name,pin:'999999'},cookie,'PATCH')).status,401);
 await post(`/api/parent/students/${id}`,{loginName:name,pin:'829371'},`lumi_session=${token}`,'PATCH');assert.equal((await (await fetch(base+'/api/session',{headers:{cookie}})).json()).data.role,null);
 for(let i=0;i<5;i++)assert.equal((await post('/api/auth/student/login',{loginName:name,pin:'000000'})).status,401);
 assert.equal((await post('/api/auth/student/login',{loginName:name,pin:'829371'})).status,401);
 console.log('Student login integration passed: PIN enrollment, hash storage, login, history ownership, credential reset revocation, lockout, no legacy bypass.');
}finally{if(id)await db`DELETE FROM students WHERE id=${id}`;if(parentHash)await db`DELETE FROM sessions WHERE token_hash=${parentHash}`;await db.end();}
