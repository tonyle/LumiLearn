import postgres from 'postgres';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
const db=postgres(process.env.DATABASE_URL,{max:1}),base='http://127.0.0.1:3000',tokens=[];
try{
 const[parent]=await db`SELECT id FROM parents ORDER BY created_at LIMIT 1`;
 const students=await db`SELECT id FROM students WHERE active=true ORDER BY grade LIMIT 1`;
 const[assignment]=await db`SELECT ast.assignment_id id FROM assignment_students ast JOIN assignments a ON a.id=ast.assignment_id WHERE ast.student_id=${students[0].id} AND a.state='assigned' LIMIT 1`;
 const[peer]=await db`SELECT id FROM students WHERE active=true AND NOT EXISTS(SELECT 1 FROM assignment_students ast WHERE ast.student_id=students.id AND ast.assignment_id=${assignment.id}) LIMIT 1`;students.push(peer);
 async function cookie(role,identity){const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex');tokens.push(hash);await db`INSERT INTO sessions(role,parent_id,student_id,token_hash,expires_at) VALUES(${role},${role==='parent'?identity:null},${role==='student'?identity:null},${hash},now()+interval '5 minutes')`;return`lumi_session=${token}`;}
 const parentCookie=await cookie('parent',parent.id),studentCookie=await cookie('student',students[0].id),otherCookie=await cookie('student',students[1].id);

 const allowed=await fetch(base+`/api/assignments/${assignment.id}/pdf`,{headers:{cookie:studentCookie}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('content-type'),'application/pdf');
 const pdf=await PDFDocument.load(await allowed.arrayBuffer());for(const page of pdf.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
 const denied=await fetch(base+`/api/assignments/${assignment.id}/pdf`,{headers:{cookie:otherCookie}});assert.equal(denied.status,403);
 const allDenied=await fetch(base+'/api/parent/print-packs',{headers:{cookie:studentCookie}});assert.equal(allDenied.status,403);
 const bundle=await fetch(base+'/api/parent/print-packs',{headers:{cookie:parentCookie}});assert.equal(bundle.status,200);
 const bytes=new Uint8Array(await bundle.arrayBuffer()),combined=await PDFDocument.load(bytes);const {tsImport}=await import('tsx/esm/api');const {letterSheets}=await tsImport('/app/lib/letter-layout.ts',import.meta.url);
 const sections=await db`SELECT a.title,json_agg(json_build_object('id',qv.id,'type',q.type,'prompt',qv.prompt,'options',qv.options) ORDER BY aq.sort_order) questions FROM assignments a JOIN assignment_questions aq ON aq.assignment_id=a.id JOIN question_versions qv ON qv.id=aq.question_version_id JOIN questions q ON q.id=qv.question_id WHERE a.state='assigned' AND a.source_assignment_id IS NOT NULL GROUP BY a.id`;
 assert.ok(sections.length>=12);assert.ok(sections.every(section=>section.questions.length===10));assert.equal(combined.getPageCount(),letterSheets(sections).length);
 for(const page of combined.getPages()){assert.equal(page.getWidth(),612);assert.equal(page.getHeight(),792);}
 await writeFile('/tmp/lumilearn-offline-letter.pdf',bytes);
 console.log('Print integration passed: student access, cross-learner denial, parent-only bundle, all ten-question lessons at 612x792 points. Export: /tmp/lumilearn-offline-letter.pdf');
}finally{for(const hash of tokens)await db`DELETE FROM sessions WHERE token_hash=${hash}`;await db.end();}
