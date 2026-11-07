import postgres from 'postgres';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
const db=postgres(process.env.DATABASE_URL,{max:1}),base='http://127.0.0.1:3000',tokens=[];
try{
 const[parent]=await db`SELECT id FROM parents ORDER BY created_at LIMIT 1`;
 const students=await db`SELECT s.id FROM students s WHERE s.active=true AND EXISTS(SELECT 1 FROM assignment_students ast JOIN assignments a ON a.id=ast.assignment_id WHERE ast.student_id=s.id AND a.state='assigned') ORDER BY s.grade LIMIT 1`;
 const[assignment]=await db`SELECT ast.assignment_id id FROM assignment_students ast JOIN assignments a ON a.id=ast.assignment_id WHERE ast.student_id=${students[0].id} AND a.state='assigned' LIMIT 1`;
 const[peer]=await db`SELECT id FROM students WHERE active=true AND NOT EXISTS(SELECT 1 FROM assignment_students ast WHERE ast.student_id=students.id AND ast.assignment_id=${assignment.id}) LIMIT 1`;students.push(peer);
 async function cookie(role,identity){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?identity:null},${role==='student'?identity:null},${hash},now()+interval '5 minutes')`;return`lumi_session=${token}`;}
 const parentCookie=await cookie('parent',parent.id),studentCookie=await cookie('student',students[0].id),otherCookie=await cookie('student',students[1].id);

 const allowed=await fetch(base+`/api/assignments/${assignment.id}/pdf`,{headers:{cookie:studentCookie}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('content-type'),'application/pdf');
 const pdf=await PDFDocument.load(await allowed.arrayBuffer());for(const page of pdf.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
 const denied=await fetch(base+`/api/assignments/${assignment.id}/pdf`,{headers:{cookie:otherCookie}});assert.equal(denied.status,403);
 const allDenied=await fetch(base+'/api/parent/print-packs',{headers:{cookie:studentCookie},redirect:'manual'});assert.ok([303,307,403].includes(allDenied.status));
 const bundle=await fetch(base+'/api/parent/print-packs',{headers:{cookie:parentCookie}});assert.equal(bundle.status,410);
 console.log('Print integration passed: per-assignment student access, cross-learner denial, Letter 612x792 points and retired bulk-print endpoint410.');
}finally{for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;await db.end();}
