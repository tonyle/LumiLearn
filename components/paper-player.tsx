"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { missingPaperQuestions } from "@/lib/paper-completion";
import { useStudyTimer } from "@/hooks/use-study-timer";
import { StudyTimer } from "./study-timer";
import { Play,Pause, Eraser, Hand, PenLine, RotateCcw, RotateCw, Send, Printer } from "lucide-react";
import { PaperInk } from "./paper-ink";
import { QUESTIONS_PER_PAGE, type InkStroke, type PaperDraft, type PaperFeedback, type PaperQuestion, type PaperResult, type PaperState } from "@/lib/paper";
const EMPTY_RESULTS:PaperResult[]=[];
const EMPTY_DRAFT:PaperDraft={};
export function PaperPlayer({ assignmentId, studentId, title, questions, aiReady, initialPage=0, readOnly=false }: {assignmentId:string;studentId:string;title:string;questions:PaperQuestion[];aiReady:boolean;initialPage?:number;readOnly?:boolean}) {
  const [page,setPage]=useState(Math.max(0,Math.min(initialPage,Math.ceil(questions.length/QUESTIONS_PER_PAGE)-1))), pages=Math.ceil(questions.length/QUESTIONS_PER_PAGE);
  if(!questions.length)return <main className="student-main"><p className="notice">This assignment has no questions yet.</p></main>;
  return <PaperPage key={page} assignmentId={assignmentId} studentId={studentId} title={title} questions={questions.slice(page*QUESTIONS_PER_PAGE,(page+1)*QUESTIONS_PER_PAGE)} pageIndex={page} pages={pages} navigate={setPage} aiReady={aiReady} readOnly={readOnly}/>;
}
function PaperPage({assignmentId,studentId,title,questions,pageIndex,pages,navigate,aiReady,readOnly=false}:{assignmentId:string;studentId:string;title:string;questions:PaperQuestion[];pageIndex:number;pages:number;navigate:(index:number)=>void;aiReady:boolean;initialPage?:number;readOnly?:boolean}) {
  const endpoint=`/api/student/assignments/${assignmentId}/pages/${pageIndex}`;
  const [draft,setDraft]=useState<PaperDraft>({}),[feedback,setFeedback]=useState<PaperFeedback|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState("");
  const [dirty,setDirty]=useState(false);
  const writing=useRef(false);
  const [navigating,setNavigating]=useState(false);
  const [missing,setMissing]=useState<number[]>([]);
  const [saving,setSaving]=useState(false),[submitting,setSubmitting]=useState(false),[retrying,setRetrying]=useState(false),[tool,setTool]=useState<"pen"|"eraser"|"move">("pen"),[zoom,setZoom]=useState(100);
  const [selected,setSelected]=useState(questions[0]?.id??""),[redo,setRedo]=useState<{id:string;stroke:InkStroke}[]>([]);
  const revision=useRef(0),latest=useRef<PaperDraft>(EMPTY_DRAFT),saved=useRef<PaperDraft>(EMPTY_DRAFT),queue=useRef<Promise<void>>(Promise.resolve()),submissionKey=useRef<string|null>(null);
  const timer=useStudyTimer(assignmentId,loaded&&!readOnly);
  const [pausing,setPausing]=useState(false),[resuming,setResuming]=useState(false);
  const covered=!readOnly&&(timer.loading||!timer.clock||timer.clock.state==='paused'&&timer.clock.started||pausing);
  const busy=submitting||navigating||covered||feedback?.status==="processing";
  const grading=submitting||feedback?.status==="processing";
  const editing=!readOnly&&timer.clock?.state==="running"&&(!feedback||retrying||feedback.status==="failed"||feedback.status==="draft");
  const editable=useCallback((id:string)=>!busy&&editing&&feedback?.results.find(r=>r.questionId===id)?.status!=="correct"&&feedback?.results.find(r=>r.questionId===id)?.status!=="needs_review",[busy,editing,feedback?.results]);
  const update=useCallback((next:PaperDraft)=>{latest.current=next;setDraft(next);setDirty(true);setError("");},[]);
  const appendStroke=useCallback((id:string,stroke:InkStroke)=>{const answer=latest.current[id]??{strokes:[],text:""};update({...latest.current,[id]:{...answer,strokes:[...answer.strokes,stroke]}});setRedo([]);},[update]);
  const writingChanged=useCallback((active:boolean)=>{writing.current=active;},[]);
  useEffect(()=>{
    let cancelled=false;
    fetch(endpoint).then(async response=>{const json=await response.json();if(!response.ok)throw Error(json.error?.message||"Could not load this page.");if(cancelled)return;const state=json.data as PaperState;revision.current=state.revision;latest.current=state.draft;saved.current=state.draft;setDraft(state.draft);setFeedback(state.feedback);setLoaded(true);}).catch(error=>{if(!cancelled)setError(error.message);});
    return()=>{cancelled=true;};
  },[endpoint]);
  const save=useCallback(()=>{
    const task=queue.current.catch(()=>{}).then(async()=>{
      const payload=latest.current;if(payload===saved.current)return;
      setSaving(true);
      try{const response=await fetch(endpoint,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({baseRevision:revision.current,draft:payload})});const json=await response.json();if(!response.ok)throw Error(json.error?.message||"Could not save this page.");revision.current=json.data.revision;saved.current=payload;setDirty(latest.current!==payload);setError("");}
      catch(error){setError(error instanceof Error?error.message:"Could not save your work.");throw error;}
      finally{setSaving(false);}
    });queue.current=task;return task;
  },[endpoint]);
  useEffect(()=>{if(!loaded||busy||!dirty)return;const timer=setTimeout(()=>{if(!writing.current)void save().catch(()=>{});},1200);return()=>clearTimeout(timer);},[draft,loaded,busy,dirty,save]);
  useEffect(()=>{
    if(feedback?.status!=="processing")return;
    const timer=setInterval(()=>{fetch(endpoint).then(r=>r.json()).then(json=>{if(json.data){setFeedback(json.data.feedback);revision.current=json.data.revision;}}).catch(()=>{});},2500);
    return()=>clearInterval(timer);
  },[feedback?.status,endpoint]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(latest.current!==saved.current||submitting){event.preventDefault();}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[submitting]);
  async function changePage(index:number){setNavigating(true);try{await save();navigate(index);}catch{setNavigating(false);}}
  async function submit(){
    const unanswered=missingPaperQuestions(questions,latest.current,feedback?.results??[],pageIndex);
    if(unanswered.length){setMissing(unanswered);return;}
    setSubmitting(true);setError("");
    try{
      await save();
      submissionKey.current??=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,"0")).join("");
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","idempotency-key":submissionKey.current},body:JSON.stringify({baseRevision:revision.current,draft:latest.current})});
      const json=await response.json();if(!response.ok){if(json.error?.code==="INCOMPLETE_PAGE"){setMissing(json.error.details.missingQuestions);submissionKey.current=null;return;}throw Error(json.error?.message||"Could not submit the page.");}
      const state=json.data as PaperState;revision.current=state.revision;latest.current=state.draft;saved.current=state.draft;setDraft(state.draft);setDirty(false);setFeedback(state.feedback);if(state.clock)timer.apply(state.clock);setRetrying(false);submissionKey.current=null;
    }catch(error){setError(error instanceof Error?error.message:"Connection lost. Your saved work is kept; try submitting again.");}finally{setSubmitting(false);}
  }
  async function retryWrong(){try{await timer.resume();}catch{setError("Could not resume the timer. Please try again.");return;}const next={...latest.current};for(const result of feedback?.results??[])if(result.status==="incorrect")next[result.questionId]={strokes:[],text:""};setRetrying(true);setRedo([]);update(next);}
  async function pauseLesson(){
    setPausing(true);
    try{try{await save();}catch{}await timer.pause();}catch{setError("Could not pause on the server. Please try again.");}finally{setPausing(false);}
  }
  async function resumeLesson(){setResuming(true);try{await timer.resume();}catch{setError("Could not resume. Check your connection and try again.");}finally{setResuming(false);}}
  const wrong=feedback?.results.filter(r=>r.status==="incorrect").length??0;
  const selectedAnswer=draft[selected]??{strokes:[],text:""};
  if(!loaded)return <main className="student-main"><p role="status">{error||"Loading your paper…"}</p></main>;
  return <main className="paper-main stack">
    <Dialog.Root open={covered} modal><Dialog.Portal><Dialog.Overlay className="study-pause-cover"/><Dialog.Content className="study-pause-dialog" onEscapeKeyDown={e=>e.preventDefault()} onPointerDownOutside={e=>e.preventDefault()} onInteractOutside={e=>e.preventDefault()}><span className="subject-icon"><Pause size={26}/></span><Dialog.Title>{timer.loading?"Getting your lesson ready…":pausing?"Pausing your lesson…":"Your lesson is paused"}</Dialog.Title><Dialog.Description>The questions are hidden. Take your time — your study clock stops while you pause.</Dialog.Description><p className="pause-time">{timer.clock?Math.floor(timer.clock.elapsedMs/60000)+" min "+Math.floor(timer.clock.elapsedMs/1000)%60+" sec":""}</p>{(timer.error||error)&&<p role="alert" className="notice">{timer.error||error}</p>}<button className="primary" disabled={timer.loading||pausing||resuming} onClick={()=>void resumeLesson()}><Play size={19}/>{resuming?"Resuming…":"Resume lesson"}</button></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={missing.length>0} onOpenChange={open=>{if(!open)setMissing([]);}}><Dialog.Portal><Dialog.Overlay className="completion-overlay"/><Dialog.Content className="completion-dialog"><span className="eyebrow">A little more to do</span><Dialog.Title>Finish every question first</Dialog.Title><Dialog.Description>Please answer all questions on this page before submitting. Your work is saved as you go.</Dialog.Description><p><strong>Unanswered questions: {missing.join(", ")}</strong></p><p className="muted">Write an answer with your pen or use the keyboard alternative.</p><Dialog.Close className="button primary">Keep working</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
    <header className="paper-heading"><div><Link href={`/s/${studentId}/home`} className="muted">← My learning</Link><h1>{title}</h1><p className="muted">Write on the paper. Submit the whole page when you’re finished.</p></div><StudyTimer frozen={grading} clock={timer.clock} onPause={()=>void pauseLesson()} disabled={grading||navigating||readOnly}/><div className="paper-score" aria-live="polite">{feedback&&feedback.status!=="processing"?<><strong>{feedback.pending?`${feedback.earned} earned`:`${feedback.earned} / ${feedback.maximum}`}</strong><span>{feedback.pending?`${feedback.pending} awaiting review`:`${wrong} to retry`}</span></>:<><strong>{questions.length*10} points</strong><span>10 points per question</span></>}</div></header>
    {readOnly&&<p className="notice">Earlier worksheet · Read only. Your original work is preserved. Open a new 10-question lesson to continue practising.</p>}
    {!readOnly&&timer.clock?.state==="submitted"&&(feedback?.status==="failed"||Number(feedback?.pending)>0)&&<button className="secondary" onClick={()=>void resumeLesson()}>Continue working</button>}
    {!aiReady&&<p className="notice">Handwritten work will be saved for your parent to review. You can keep writing on every page.</p>}
    {feedback?.status==="failed"&&<p className="notice" role="alert">Grading did not finish. Your paper is saved. Try submitting again or ask your parent to review it.</p>}
    {error&&<p className="notice" role="alert">{error} <button className="ghost" onClick={()=>void save().catch(()=>{})}>Try saving again</button></p>}
    <div className="paper-toolbar" role="toolbar" aria-label="Worksheet tools">
      <button className={tool==="pen"?"secondary":"ghost"} aria-pressed={tool==="pen"} disabled={busy} onClick={()=>setTool("pen")}><PenLine size={18}/> Pen</button>
      <button className={tool==="eraser"?"secondary":"ghost"} aria-pressed={tool==="eraser"} disabled={busy} onClick={()=>setTool("eraser")}><Eraser size={18}/> Eraser</button>
      <button className={tool==="move"?"secondary":"ghost"} aria-pressed={tool==="move"} onClick={()=>setTool("move")}><Hand size={18}/> Move page</button>
      <button className="ghost" aria-label="Undo last stroke in selected answer" disabled={!editable(selected)||!selectedAnswer.strokes.length} onClick={()=>{setRedo([{id:selected,stroke:selectedAnswer.strokes[selectedAnswer.strokes.length-1]},...redo]);update({...latest.current,[selected]:{...selectedAnswer,strokes:selectedAnswer.strokes.slice(0,-1)}});}}><RotateCcw size={18}/> Undo</button>
      <button className="ghost" disabled={!redo.length||!editable(redo[0]?.id??"")} onClick={()=>{const [item,...rest]=redo;const answer=latest.current[item.id]??{strokes:[],text:""};update({...latest.current,[item.id]:{...answer,strokes:[...answer.strokes,item.stroke]}});setRedo(rest);}}><RotateCw size={18}/> Redo</button>
      <Link className="button ghost" href={`/print/${assignmentId}?page=${pageIndex}`} target="_blank"><Printer size={18}/> Print page</Link><Link className="button ghost" href={`/print/${assignmentId}`} target="_blank">Print all</Link>
      <label className="paper-zoom">Zoom <select aria-label="Paper zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[100,125,150,200].map(value=><option key={value} value={value}>{value}%</option>)}</select></label>
      <span className="muted" role="status">{navigating?"Saving page…":grading?"Grading whole page…":covered?"Paused":saving?"Saving in background…":dirty?"Waiting to save…":"Saved"}</span>
    </div>
    <div className="paper-viewport"><div style={{width:`${zoom}%`,minWidth:"100%"}}><PaperInk questions={questions} title={title} pageIndex={pageIndex} draft={draft} results={feedback?.results??EMPTY_RESULTS} tool={tool} editable={editable} onSelect={setSelected} onWritingChange={writingChanged} onChange={appendStroke}/></div></div>
    <details className="card paper-keyboard"><summary>Keyboard alternative & accessible question text</summary><div className="stack">{questions.map((q,index)=><label className="field" key={q.id}>{pageIndex*10+index+1}. {q.prompt.text}{q.options.length>0&&<small className="muted">{q.options.map((o,i)=>`${String.fromCharCode(65+i)}: ${o.text}`).join(" · ")} · Use letters separated by commas for multiple answers or ordering.</small>}<textarea aria-label={`Answer ${pageIndex*10+index+1}`} rows={2} disabled={!editable(q.id)} value={draft[q.id]?.text??""} onChange={event=>{const answer=latest.current[q.id]??{strokes:[],text:""};update({...latest.current,[q.id]:{...answer,text:event.target.value}});}}/></label>)}</div></details>
    <footer className="paper-submit-bar"><div className="row"><button className="ghost" disabled={pageIndex===0||busy} onClick={()=>void changePage(pageIndex-1)}>← Previous page</button><strong>Page {pageIndex+1} / {pages}</strong><button className="ghost" disabled={pageIndex===pages-1||busy} onClick={()=>void changePage(pageIndex+1)}>Next page →</button></div><div className="row">{!readOnly&&wrong>0&&!retrying&&!busy&&<button className="secondary" onClick={()=>void retryWrong()}>Redo {wrong} wrong {wrong===1?"answer":"answers"}</button>}{!readOnly&&(!feedback||retrying||feedback.status==="failed"||feedback.pending>0)&&<button className="primary" disabled={busy||timer.clock?.state!=="running"} onClick={()=>void submit()}><Send size={18}/>{busy?"Grading page…":retrying?"Submit corrections":"Submit whole page"}</button>}{feedback&&feedback.pending===0&&wrong===0&&<span className="notice success">✓ All correct!</span>}</div></footer>
  </main>;
}
