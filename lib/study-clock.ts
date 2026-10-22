export type StudyClock={state:'paused'|'running'|'submitted';elapsedMs:number;started:boolean;serverNow:number;leaseUntil:number|null};
export type ClockRow={state:StudyClock['state'];elapsed_ms:number|string;started_at:Date|string|null;running_since:Date|string|null;lease_until:Date|string|null};
export const CLOCK_LEASE_MS=45_000;
export function clockSnapshot(row:ClockRow,now=Date.now()):StudyClock {
 const lease=row.lease_until?new Date(row.lease_until).getTime():null;
 const elapsed=row.state==='running'&&row.running_since?Math.max(0,Math.min(now,lease??now)-new Date(row.running_since).getTime()):0;
 return {state:row.state==='running'&&lease!==null&&lease<=now?'paused':row.state,elapsedMs:Number(row.elapsed_ms)+elapsed,started:!!row.started_at,serverNow:now,leaseUntil:lease};
}
export function formatStudyTime(ms:number){const seconds=Math.floor(Math.max(0,ms)/1000),hours=Math.floor(seconds/3600);return `${hours?`${hours}:`:''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
