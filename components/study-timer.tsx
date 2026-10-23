"use client";
import {useEffect,useRef,useState} from 'react';import {Pause,Timer,LogOut} from 'lucide-react';import {formatStudyTime,type StudyClock} from '@/lib/study-clock';
export function StudyTimer({clock,onPause,disabled,frozen=false,onExit,exitDisabled=false,exiting=false}:{clock:StudyClock|null;onPause:()=>void;disabled:boolean;frozen?:boolean;onExit?:()=>void;exitDisabled?:boolean;exiting?:boolean}){
 const [elapsed,setElapsed]=useState(clock?.elapsedMs??0);
 const baseline=useRef<{clock:StudyClock|null;at:number}>({clock:null,at:0});
 useEffect(()=>{
  if(baseline.current.clock!==clock)baseline.current={clock,at:performance.now()};
  if(frozen)return;
  const start=baseline.current.at;const tick=()=>setElapsed((clock?.elapsedMs??0)+(clock?.state==='running'?Math.min(Math.max(0,performance.now()-start),Math.max(0,(clock.leaseUntil??clock.serverNow)-clock.serverNow)):0));tick();
  if(clock?.state!=='running')return;const timer=setInterval(tick,1000);return()=>clearInterval(timer);
 },[clock,frozen]);
 return <div className="study-timer"><Timer size={19}/><div><span className="muted">{clock?.state==='submitted'?'Time spent':'Study time'}</span><strong aria-label="Study duration">{clock?.started?formatStudyTime(elapsed):'—'}</strong></div>{clock?.state==='running'&&<button className="secondary" onClick={onPause} disabled={disabled}><Pause size={16}/> Pause</button>}{onExit&&<button className="ghost study-exit" onClick={onExit} disabled={exitDisabled}><LogOut size={16}/>{exiting?'Saving…':'Exit'}</button>}</div>;
}
