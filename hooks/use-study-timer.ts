"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {StudyClock} from '@/lib/study-clock';
export function useStudyTimer(assignmentId:string,enabled:boolean){
 const [clock,setClock]=useState<StudyClock|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const endpoint=`/api/student/assignments/${assignmentId}/timer`,latest=useRef<StudyClock|null>(null),serial=useRef(Promise.resolve()),receivedAt=useRef(0),locallyPaused=useRef(false);
 const apply=useCallback((value:StudyClock)=>{latest.current=value;receivedAt.current=performance.now();setClock(value);},[]);
 const change=useCallback((action:'start'|'resume'|'pause'|'heartbeat')=>{
  const task=serial.current.catch(()=>{}).then(async()=>{
   const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const json=await response.json();
   if(!response.ok)throw Error(json.error?.message||'Could not sync the timer.');
   if(action==='resume')locallyPaused.current=false;
   if(!locallyPaused.current||json.data.state!=='running')apply(json.data);setError('');
  });serial.current=task;return task;
 },[endpoint,apply]);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;
  void change('start').then(()=>{if(!cancelled)setLoading(false);}).catch(()=>{if(!cancelled){setError('Could not start your timer. Check your connection and try Resume.');setLoading(false);}});
  return()=>{cancelled=true;};
 },[enabled,change]);
 useEffect(()=>{
  if(!enabled)return;
  const interval=setInterval(()=>{if(latest.current?.state==='running')void change('heartbeat').catch(()=>setError('Connection lost. Pause and resume when you are back online.'));},15_000);
  const expire=setInterval(()=>{
   const value=latest.current;
   if(value?.state==='running'&&value.leaseUntil!==null&&performance.now()-receivedAt.current>=value.leaseUntil-value.serverNow){
    apply({...value,state:'paused',elapsedMs:value.elapsedMs+Math.max(0,value.leaseUntil-value.serverNow),serverNow:Date.now()});
   }
  },1000);
  function hide(){
   if(latest.current?.state!=='running')return;
   locallyPaused.current=true;
   const value=latest.current;apply({...value,state:'paused',elapsedMs:value.elapsedMs+Math.max(0,Math.min(performance.now()-receivedAt.current,(value.leaseUntil??value.serverNow)-value.serverNow)),serverNow:Date.now()});
   navigator.sendBeacon?.(endpoint,new Blob([JSON.stringify({action:'pause'})],{type:'application/json'}));
  }
  function visibility(){if(document.hidden)hide();}
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);
  return()=>{clearInterval(interval);clearInterval(expire);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);hide();};
 },[enabled,endpoint,change,apply]);
 const pause=useCallback(()=>{locallyPaused.current=true;const value=latest.current;if(value?.state==='running')apply({...value,state:'paused',elapsedMs:value.elapsedMs+Math.max(0,Math.min(performance.now()-receivedAt.current,(value.leaseUntil??value.serverNow)-value.serverNow)),serverNow:Date.now()});return change('pause');},[change,apply]);
 const resume=useCallback(()=>change('resume'),[change]);
 return {clock,loading:enabled&&loading,error,pause,resume,apply};
}
