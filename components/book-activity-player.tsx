'use client';
import {useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type {BookDetail} from '@/lib/book-contract';
import type {ActivityAnswer,ActivityDraft,ActivityState,BookActivity,ActivityAttempt} from '@/lib/book-activity-contract';
import {bookJson,bookRequest} from './book-api';
import {BookActivityCanvas} from './book-activity-canvas';
import {createActivitySaver} from '@/lib/book-activity-save-client';
import {renderActivityInkPng} from '@/lib/book-activity-drawing';
import styles from './book-activities.module.css';
import {BookActivityAttemptViewer} from './book-activity-attempt';
function sameDraft(a:ActivityDraft,b:ActivityDraft){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(id=>{const x=a[id],y=b[id];return !!y&&x.text===y.text&&x.strokes.length===y.strokes.length&&x.strokes.every((s,i)=>{const t=y.strokes[i];return s.tool===t.tool&&s.color===t.color&&s.width===t.width&&s.points.length===t.points.length&&s.points.every((p,j)=>p.x===t.points[j].x&&p.y===t.points[j].y&&p.p===t.points[j].p);});});}
const emptyAnswer:ActivityAnswer={strokes:[],text:''};
export function BookActivities({detail,onClose}:{detail:BookDetail;onClose:()=>void}){
 const [activities,setActivities]=useState<BookActivity[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;bookRequest<{activities:BookActivity[]}>(`/api/books/${detail.book.id}/activities`).then(data=>{if(live)setActivities(data.activities);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[detail.book.id]);
 if(selected)return <BookActivityPlayer key={selected} detail={detail} activityId={selected} onClose={()=>setSelected('')}/>;
 return <section className={styles.room} aria-label="Book activities"><header className={styles.bar}><button onClick={onClose}>← Back to book</button><h1>Book activities</h1></header><div className={styles.activityList}><p>Draw, write and show what you learned from {detail.book.title}.</p>{loading&&<p role="status">Loading activities…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!activities.length&&<p>No activities yet. Your parent can add drawing and writing areas in Book studio.</p>}{activities.map(a=><button className={styles.activityCard} key={a.id} onClick={()=>setSelected(a.id)}><strong>{a.title}</strong><span>{a.parts.length} answer areas · {a.parts.length*10} points</span><small>{a.instructions}</small><b>Open activity →</b></button>)}</div></section>;
}
export function BookActivityPlayer({detail,activityId,onClose}:{detail:BookDetail;activityId:string;onClose:()=>void}){
 const [activity,setActivity]=useState<BookActivity|null>(null),[state,setState]=useState<ActivityState|null>(null),[draft,setDraft]=useState<ActivityDraft>({}),[partIndex,setPartIndex]=useState(0),[status,setStatus]=useState('Loading…'),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false),[exiting,setExiting]=useState(false),[missing,setMissing]=useState<string[]>([]),[resultsOpen,setResultsOpen]=useState(false),[viewAttempt,setViewAttempt]=useState<ActivityAttempt|null>(null);
 const draftRef=useRef<ActivityDraft>({}),stateRef=useRef<ActivityState|null>(null),dirty=useRef(false),version=useRef(0),saving=useRef<Promise<void>|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(true),submitKey=useRef<string|null>(null),writing=useRef(false),flushCanvas=useRef<(()=>void)|null>(null),saver=useRef<ReturnType<typeof createActivitySaver>|null>(null);
 const base=`/api/books/${detail.book.id}/activities/${activityId}`;
 useEffect(()=>{mounted.current=true;bookRequest<{activity:BookActivity;state:ActivityState}>(base).then(data=>{if(!mounted.current)return;setActivity(data.activity);stateRef.current=data.state;setState(data.state);draftRef.current=data.state.draft;setDraft(data.state.draft);dirty.current=data.state.draftActivityRevision!==undefined&&data.state.draftActivityRevision!==data.state.activityRevision;setStatus(dirty.current?'Activity updated · save before continuing':'All changes saved');}).catch(e=>{if(mounted.current)setError(e.message);});return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);saver.current?.destroy();saver.current=null;};},[base]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty.current||saving.current||writing.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 const checking=state?.attempts.some(a=>a.state==='processing')??false;
 useEffect(()=>{if(!checking)return;let live=true;const clock=setInterval(()=>{bookRequest<{activity:BookActivity;state:ActivityState}>(base).then(({activity:nextActivity,state:next})=>{if(!mounted.current||!live)return;if(dirty.current&&next.activityRevision!==activity?.revision){setState(previous=>previous?{...previous,attempts:next.attempts}:previous);setError('Your parent changed this activity. Save a copy of any unsaved answer before reloading.');return;}stateRef.current=next;setState(next);if(!dirty.current){setActivity(nextActivity);setPartIndex(current=>Math.min(current,nextActivity.parts.length-1));draftRef.current=next.draft;setDraft(next.draft);}if(!next.attempts.some(a=>a.state==='processing')){setResultsOpen(true);setStatus('Work saved');if(next.attempts[0]?.state==='failed'){submitKey.current=null;setError('Checking did not finish. Your work is saved; submit again to retry.');}}}).catch(()=>{});},2500);return()=>{live=false;clearInterval(clock);};},[base,checking,activity?.revision]);
 async function save(){
  if(timer.current){clearTimeout(timer.current);timer.current=null;}
  if(saving.current)return saving.current;
  const operation=(async()=>{
   try{
    while(dirty.current&&stateRef.current){
     if(writing.current)break;
     const sentVersion=version.current,sentDraft=draftRef.current,current=stateRef.current;
     setStatus('Saving…');saver.current??=createActivitySaver();let result;try{result=await saver.current.save(base,{baseRevision:current.revision,activityRevision:current.activityRevision,draft:sentDraft});}catch(saveError){const fresh=await bookRequest<{state:ActivityState}>(base).catch(()=>null);while(writing.current&&mounted.current)await new Promise(resolve=>setTimeout(resolve,50));if(!fresh||!mounted.current||fresh.state.activityRevision!==current.activityRevision||fresh.state.revision!==current.revision+1||!sameDraft(fresh.state.draft,sentDraft))throw saveError;result=fresh.state;}
     const nextState={...current,revision:result.revision,activityRevision:result.activityRevision,draftActivityRevision:result.draftActivityRevision,draft:sentDraft};stateRef.current=nextState;dirty.current=version.current!==sentVersion;
     if(mounted.current){setState(nextState);setStatus(dirty.current?'Unsaved changes':'All changes saved');}
    }
   }catch(e){dirty.current=true;if(mounted.current){setStatus('Not saved · retry');setError((e as Error).message);}throw e;}
  })();saving.current=operation;
  try{await operation;}finally{saving.current=null;}
 }
 function writingChanged(active:boolean){writing.current=active;if(timer.current){clearTimeout(timer.current);timer.current=null;}if(!active&&dirty.current&&mounted.current)timer.current=setTimeout(()=>{void save().catch(()=>{});},1000);}
 function change(answer:ActivityAnswer){if(!activity)return;const next={...draftRef.current,[activity.parts[partIndex].id]:answer};const points=Object.values(next).reduce((n,a)=>n+a.strokes.reduce((m,s)=>m+s.points.length,0),0);if(points>40000){setError('This activity has a lot of drawing. Erase or undo some marks before adding more.');return;}version.current++;dirty.current=true;submitKey.current=null;draftRef.current=next;setDraft(next);setStatus('Unsaved changes');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{void save().catch(()=>{});},1000);}
 async function exit(){setExiting(true);try{flushCanvas.current?.();await save();if(!dirty.current&&!writing.current)onClose();}catch{/* Stay here so unsaved work is not lost. */}finally{setExiting(false);}}
 async function submit(){
  if(!activity||submitting)return;
  flushCanvas.current?.();
  const unanswered=activity.parts.filter(p=>{const a=draftRef.current[p.id];return!a||(!a.text.trim()&&!a.strokes.some(s=>s.tool!=='eraser'&&s.points.length>0));});
  if(unanswered.length){setMissing(unanswered.map(p=>p.label));return;}
  setSubmitting(true);setError('');try{
   await save();const current=stateRef.current!;const images=[];
   for(const part of activity.parts){images.push({partId:part.id,png:await renderActivityInkPng(draftRef.current[part.id]??emptyAnswer,`/api/books/${detail.book.id}/pages/${part.pageId}/image`,part)});}
   submitKey.current??=crypto.randomUUID();
   const result=await bookRequest<{state:ActivityState}>(base,bookJson({key:submitKey.current,baseRevision:current.revision,activityRevision:current.activityRevision,images}));
   stateRef.current=result.state;setState(result.state);draftRef.current=result.state.draft;setDraft(result.state.draft);setResultsOpen(true);setStatus(result.state.attempts.some(a=>a.state==='processing')?'Checking your work…':'Submitted · work saved');if(!result.state.attempts.some(a=>a.state==='processing'))submitKey.current=null;if(result.state.attempts[0]?.state==='failed')setError('Checking did not finish. Your work is saved; submit again to retry.');
  }catch(e){if((e as {code?:string}).code==='GRADING_FAILED')submitKey.current=null;if(!dirty.current){try{const fresh=await bookRequest<{activity:BookActivity;state:ActivityState}>(base);stateRef.current=fresh.state;setActivity(fresh.activity);setPartIndex(current=>Math.min(current,fresh.activity.parts.length-1));setState(fresh.state);draftRef.current=fresh.state.draft;setDraft(fresh.state.draft);if(fresh.state.attempts[0]?.state==='failed')submitKey.current=null;}catch{/* Keep the last saved version until the connection returns. */}}setError((e as Error).message);}finally{setSubmitting(false);}
 }
 const part=activity?.parts[partIndex],page=detail.pages.find(p=>p.id===part?.pageId);
 return <section className={styles.room} aria-label="Book activity workspace"><header className={styles.bar}><button disabled={submitting||exiting} onClick={()=>void exit()}>← Save & back</button><div><h1>{activity?.title||'Book activity'}</h1><small role="status">{status}</small></div><button disabled={status==='All changes saved'||submitting||exiting} onClick={()=>{flushCanvas.current?.();void save().catch(()=>{});}}>Save</button><button className={styles.primary} disabled={!activity||submitting||exiting||checking} onClick={()=>void submit()}>{submitting?'Checking your work…':'Submit activity'}</button></header>
 {error&&<p role="alert" className={styles.notice}>{error}</p>}
 {activity&&<><div className={styles.instructions}><p>{activity.instructions}</p><nav aria-label="Answer areas">{activity.parts.map((p,i)=><button disabled={submitting||exiting} aria-pressed={i===partIndex} key={p.id} onClick={()=>{flushCanvas.current?.();setPartIndex(i);}}>{i+1}. {p.label}</button>)}</nav><button onClick={()=>setResultsOpen(!resultsOpen)}>{resultsOpen?'Hide results':'Results & history'} ({state?.attempts.length??0})</button></div>
 {part&&page&&<div className={styles.canvasStage}><BookActivityCanvas key={part.id} part={part} imageUrl={`/api/books/${detail.book.id}/pages/${part.pageId}/image`} pageWidth={page.width} pageHeight={page.height} answer={draft[part.id]??emptyAnswer} onChange={change} onWritingChange={writingChanged} onFlushReady={flush=>{flushCanvas.current=flush;}} pointLimit={Math.max(0,40000-Object.entries(draft).filter(([id])=>id!==part.id).reduce((n,[,a])=>n+a.strokes.reduce((m,s)=>m+s.points.length,0),0))} readOnly={submitting||exiting||checking}/></div>}
 {viewAttempt&&<BookActivityAttemptViewer detail={detail} activity={activity} attempt={viewAttempt} onClose={()=>setViewAttempt(null)}/>}
 {resultsOpen&&<aside className={styles.history} aria-label="Activity results"><h2>Results & history</h2>{!state?.attempts.length&&<p>Submit your completed activity to see feedback.</p>}{state?.attempts.map((attempt,i)=><details key={attempt.id} open={i===0}><summary>{new Date(attempt.created_at).toLocaleString()} · {attempt.earned}/{attempt.maximum}{attempt.results.some(r=>r.needsReview)?' · Parent review needed':''}</summary><button onClick={()=>setViewAttempt(attempt)}>View saved submission</button>{attempt.results.map(r=><div key={r.partId}><strong>{attempt.activitySnapshot?.parts.find(p=>p.id===r.partId)?.label||activity.parts.find(p=>p.id===r.partId)?.label||'Answer area'} · {r.points===null?'Needs review':`${r.points}/${r.maximum}`}</strong><p>{r.feedback}</p>{r.transcription&&<p>You wrote: {r.transcription}</p>}</div>)}</details>)}</aside>}
 </>}
 <Dialog.Root open={missing.length>0} onOpenChange={open=>{if(!open)setMissing([]);}}><Dialog.Portal><Dialog.Overlay className={styles.modalShade}/><Dialog.Content className={styles.modal}><Dialog.Title>Finish every answer area first</Dialog.Title><Dialog.Description>Please complete these before submitting:</Dialog.Description><ul>{missing.map((label,i)=><li key={i}>{label}</li>)}</ul><Dialog.Close asChild><button className={styles.primary}>Keep working</button></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
 </section>;
}
