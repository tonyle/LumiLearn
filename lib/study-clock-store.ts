import type {TransactionSql} from 'postgres';
import {sql} from './db';
import {clockSnapshot,CLOCK_LEASE_MS,type ClockRow,type StudyClock} from './study-clock';
export type ClockAction='start'|'resume'|'pause'|'heartbeat'|'finish'|'read';
export async function changeClock(tx:TransactionSql,studentId:string,assignmentId:string,action:ClockAction):Promise<StudyClock>{
 await tx`INSERT INTO study_clocks(assignment_id,student_id) VALUES(${assignmentId},${studentId}) ON CONFLICT DO NOTHING`;
 const [raw]=await tx`SELECT *,extract(epoch FROM clock_timestamp())*1000 AS now_ms FROM study_clocks WHERE assignment_id=${assignmentId} AND student_id=${studentId} FOR UPDATE`;
 const now=Number(raw.now_ms),snapshot=clockSnapshot(raw as unknown as ClockRow,now);
 let state=snapshot.state,started=snapshot.started;
 if(action==='resume'||action==='start'&&!started){state='running';started=true;}
 if(action==='pause')state='paused';
 if(action==='finish')state='submitted';
 const running=state==='running',lease=running?now+CLOCK_LEASE_MS:null;
 await tx`UPDATE study_clocks SET state=${state},elapsed_ms=${Math.floor(snapshot.elapsedMs)},started_at=CASE WHEN ${started} THEN coalesce(started_at,${new Date(now)}) ELSE started_at END,running_since=${running?new Date(now):null},lease_until=${lease?new Date(lease):null},updated_at=now() WHERE assignment_id=${assignmentId} AND student_id=${studentId}`;
 return {state,started,elapsedMs:Math.floor(snapshot.elapsedMs),serverNow:now,leaseUntil:lease};
}
export async function runningClock(tx:TransactionSql,studentId:string,assignmentId:string){
 const [row]=await tx`SELECT *,extract(epoch FROM clock_timestamp())*1000 AS now_ms FROM study_clocks WHERE assignment_id=${assignmentId} AND student_id=${studentId} FOR UPDATE`;
 if(!row||clockSnapshot(row as unknown as ClockRow,Number(row.now_ms)).state!=='running')throw new Error('LESSON_PAUSED');
}
export async function readClock(studentId:string,assignmentId:string){const [row]=await sql`SELECT *,extract(epoch FROM clock_timestamp())*1000 AS now_ms FROM study_clocks WHERE assignment_id=${assignmentId} AND student_id=${studentId}`;return row?clockSnapshot(row as unknown as ClockRow,Number(row.now_ms)):null;}
