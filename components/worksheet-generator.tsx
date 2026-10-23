"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,BookOpen,CheckCircle2,LoaderCircle,Sparkles} from 'lucide-react';
import {GRADES,SUBJECTS,browserRequestKey} from '@/lib/worksheet-authoring';
import {generationParametersSchema,generationErrorMessage,type GenerationBatch,type GenerationParameters} from '@/lib/worksheet-generation';
const defaultParameters:GenerationParameters={grade:'5',subject:'math',topic:'',count:5,difficulty:'grade_level',instructions:''};
export function WorksheetGenerator({aiReady}:{aiReady:boolean}){
 const router=useRouter(),[parameters,setParameters]=useState(defaultParameters),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(''),fingerprint=useRef('');
 async function create(event:React.FormEvent){event.preventDefault();setError('');const parsed=generationParametersSchema.safeParse(parameters);if(!parsed.success){setError('Enter a topic and choose between 1 and 10 worksheets.');return;}setBusy(true);
 try{const body=JSON.stringify(parsed.data);if(!key.current||body!==fingerprint.current){key.current=browserRequestKey();fingerprint.current=body;}const response=await fetch('/api/parent/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({creationKey:key.current,parameters:parsed.data})});const json=await response.json();if(!response.ok)throw Error(json.error?.message||'Could not start generation.');router.push(`/parent/generate/${json.data.id}?start=1`);}catch(error){setError(error instanceof Error?error.message:'Could not start generation.');setBusy(false);}}
 function update<K extends keyof GenerationParameters>(key:K,value:GenerationParameters[K]){setParameters(p=>({...p,[key]:value}));}
 return <div className="generation-layout"><form className="card stack generation-form" onSubmit={create}><div className="row"><span className="subject-icon"><Sparkles/></span><div><h2>What are we practicing?</h2><p className="muted">One topic. A whole collection of fresh practice.</p></div></div>
 {error&&<p className="notice" role="alert">{error}</p>}
 {!aiReady&&<p className="notice">AI generation is unavailable. Enable external AI in Settings and configure the server API key. <Link className="text-link" href="/parent/settings">Open settings</Link></p>}
 <fieldset className="stack generation-fields" disabled={busy}><div className="author-two-columns"><label className="field">Grade<select value={parameters.grade} onChange={e=>update('grade',e.target.value as GenerationParameters['grade'])}>{GRADES.map(g=><option key={g} value={g}>{g==='K'?'Kindergarten':g==='Pre-K'?g:`Grade ${g}`}</option>)}</select></label><label className="field">Subject<select value={parameters.subject} onChange={e=>update('subject',e.target.value as GenerationParameters['subject'])}>{Object.entries(SUBJECTS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
 <label className="field">Topic<input aria-label="Topic" required minLength={2} maxLength={500} placeholder="e.g. Multiplying decimals" value={parameters.topic} onChange={e=>update('topic',e.target.value)}/><small className="muted">A focused topic gives each worksheet a clear learning goal.</small></label>
 <div className="author-two-columns"><label className="field">Number of worksheets<input type="number" min={1} max={10} required value={parameters.count||''} onChange={e=>update('count',Number(e.target.value))}/></label><label className="field">Difficulty<select value={parameters.difficulty} onChange={e=>update('difficulty',e.target.value as GenerationParameters['difficulty'])}><option value="review">Gentle review</option><option value="grade_level">On grade level</option><option value="advanced">Extra challenge</option></select></label></div>
 <label className="field">Additional guidance <span className="muted">Optional</span><textarea maxLength={2000} placeholder="e.g. Include money word problems. Use tenths and hundredths." value={parameters.instructions} onChange={e=>update('instructions',e.target.value)}/></label></fieldset>
 <div className="generation-summary"><BookOpen size={21}/><span><strong>{parameters.count||0} worksheets · {(parameters.count||0)*10} questions</strong><small>10 questions per worksheet · 100 points each</small></span></div>
 <button className="primary" disabled={busy||!aiReady}><Sparkles size={18}/>{busy?'Starting your collection…':`Generate ${parameters.count||0} worksheet${parameters.count===1?'':'s'}`}</button>
 <small className="muted">Your topic and guidance are sent to OpenAI. Review the generated questions and answers before assigning.</small></form>
 <aside className="generation-guide card stack"><span className="eyebrow">From idea to practice</span><h2>A little planning.<br/>A lot of learning.</h2>{[['01','Make it yours','Choose a grade, subject and focused topic.'],['02','Create a collection','AI writes distinct questions and private answer keys. Each finished worksheet is saved automatically.'],['03','Review, then assign','Edit questions, preview the paper layout and choose your students.']].map(([n,title,text])=><div className="generation-guide-step" key={n}><span>{n}</span><div><strong>{title}</strong><p className="muted">{text}</p></div></div>)}<p className="muted">Made for iPad handwriting and Letter-size printing. Curriculum alignment remains unverified until you check it.</p></aside></div>;
}
export function GenerationProgress({initialBatch,autoStart=false}:{initialBatch:GenerationBatch;autoStart?:boolean}){
 const [batch,setBatch]=useState(initialBatch),[busy,setBusy]=useState(false),[error,setError]=useState('');const running=useRef(false),mounted=useRef(true);
 async function refresh(){const response=await fetch(`/api/parent/generate/${batch.id}`,{cache:'no-store'});const json=await response.json();if(!response.ok)throw Error(json.error?.message||'Could not load the saved batch.');if(mounted.current)setBatch(json.data);return json.data as GenerationBatch;}
 async function run(){if(running.current)return;running.current=true;setBusy(true);setError('');try{
  let current=await refresh();
  for(const item of current.items){if(!mounted.current)break;if(item.state==='ready')continue;
   setBatch(b=>({...b,items:b.items.map(i=>i.position===item.position?{...i,state:'processing'}:i)}));
   const response=await fetch(`/api/parent/generate/${batch.id}/items/${item.position}`,{method:'POST'});const json=await response.json();if(!response.ok){current=await refresh();setError(json.error?.message||generationErrorMessage(json.error?.code));break;}
   current=json.data;if(mounted.current)setBatch(current);
  }
 }catch(error){if(mounted.current){setError(error instanceof Error?error.message:'Connection interrupted. Reopen this batch to continue.');try{await refresh();}catch{ /* Saved batches can be reopened after connectivity returns. */ }}}
 finally{running.current=false;if(mounted.current)setBusy(false);}}
 useEffect(()=>{mounted.current=true;const timer=autoStart?setTimeout(()=>void run(),0):undefined;return()=>{mounted.current=false;clearTimeout(timer);};
 // The saved batch is the durable source; only start automatically on first mount.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const ready=batch.items.filter(i=>i.state==='ready').length,complete=ready===batch.parameters.count;
 return <div className="stack"><section className="card stack generation-progress"><div className="section-heading"><div><span className="eyebrow">{complete?'Your collection is ready':'Creating your collection'}</span><h2>{ready} of {batch.parameters.count} worksheets saved</h2></div><span className="subject-icon">{busy?<LoaderCircle className="generation-spinner"/>:<CheckCircle2/>}</span></div><progress aria-label="Worksheets generated" max={batch.parameters.count} value={ready}/><p className="muted">Grade {batch.parameters.grade} · {SUBJECTS[batch.parameters.subject]} · {batch.parameters.topic}</p>
 {error&&<p className="notice" role="alert">{error}</p>}
 {!complete&&<><p className="muted">Keep this page open while generating. Each worksheet may take up to 2 minutes. Finished drafts stay saved; return to this collection to continue if interrupted.</p><button className="primary" disabled={busy} onClick={()=>void run()}>{busy?<><LoaderCircle className="generation-spinner" size={18}/>Generating your next worksheet…</>:<><Sparkles size={18}/>Continue unfinished worksheets</>}</button></>}
 {complete&&<p className="notice success">All worksheets have 10 questions and private answer keys. Open each draft to review, edit and Assign to students.</p>}</section>
 <div className="worksheet-grid">{batch.items.map(item=><article className="card stack" key={item.position}><div className="section-heading"><span className="eyebrow">Worksheet {item.position+1}</span><span className="pill">{item.state==='ready'?'Draft ready':item.state==='processing'?'Generating…':item.state==='failed'?'Needs retry':'Waiting'}</span></div><h2>{item.title||batch.parameters.topic}</h2><p className="muted">10 questions · 100 points</p>{item.error_code&&<p className="notice">{generationErrorMessage(item.error_code)}</p>}{item.warnings.length>0&&<div className="notice"><strong>Review notes</strong><ul>{item.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}{item.draft_id?<Link href={`/parent/worksheets/${item.draft_id}`} className="button secondary">Review & assign<ArrowRight size={17}/></Link>:<p className="muted">{item.state==='processing'?'Writing questions and checking the answer keys.':'Your draft will appear here as soon as it is ready.'}</p>}</article>)}</div></div>;
}
