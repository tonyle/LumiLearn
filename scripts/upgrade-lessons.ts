import postgres from 'postgres';import {upgradeLesson} from '../lib/lesson-upgrade';
const db=postgres(process.env.DATABASE_URL!,{max:1});
try{await db.begin(async tx=>{
 await tx`SELECT pg_advisory_xact_lock(163021,3)`;
 const sources=await tx`SELECT a.id FROM assignments a JOIN assignment_questions aq ON aq.assignment_id=a.id WHERE a.state='assigned' AND a.source_assignment_id IS NULL GROUP BY a.id HAVING count(*)<>10`;
 for(const source of sources){const count=await upgradeLesson(tx,String(source.id));console.log(`Created ${count} ten-question lessons; preserved original ${source.id}.`);}
});}finally{await db.end();}
