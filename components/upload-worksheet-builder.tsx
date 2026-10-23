"use client";
import Link from 'next/link';import {useState} from 'react';import {useRouter} from 'next/navigation';import {BookOpen,Sparkles,ArrowRight,PenLine} from 'lucide-react';import {GRADES,SUBJECTS,type AuthorDraft} from '@/lib/worksheet-authoring';
type DraftLink={id:string;title:string};
export function UploadWorksheetBuilder({uploadId,initialDrafts=[],initialWarnings=[],aiReady}:{uploadId:string;initialDrafts?:DraftLink[];initialWarnings?:string[];aiReady:boolean}){
 const router=useRouter(),[grade,setGrade]=useState<AuthorDraft['grade']>('5'),[subject,setSubject]=useState<AuthorDraft['subject']>('math'),[drafts,setDrafts]=useState(initialDrafts),[warnings,setWarnings]=useState(initialWarnings),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(mode:'ai'|'manual'){
  setBusy(true);setError('');try{const response=await fetch(`/api/parent/uploads/${uploadId}/worksheets`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grade,subject,mode})});const json=await response.json();if(!response.ok)throw Error(json.error?.message||'Could not create worksheet drafts.');setDrafts(json.data.drafts);setWarnings(json.data.warnings);router.refresh();}catch(error){setError(error instanceof Error?error.message:'Could not read the worksheet.');}finally{setBusy(false);}
 }
 return <section className="card stack"><span className="subject-icon"><BookOpen size={26}/></span><div><h2>{drafts.length?'Ready to review':'Turn this upload into practice.'}</h2><p className="muted">Read the questions, check the answer keys, then choose your students.</p></div>
 {error&&<p className="notice" role="alert">{error}</p>}
 {drafts.length?<><p className="notice success">{drafts.length} worksheet {drafts.length===1?'draft is':'drafts are'} ready. Each worksheet has 10 question slots.</p>{warnings.length>0&&<div className="notice"><strong>Check these details before assigning</strong><ul>{warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}<div className="stack">{drafts.map((draft,i)=><Link className="upload-draft-link" href={`/parent/worksheets/${draft.id}`} key={draft.id}><span><small className="eyebrow">Worksheet {i+1} · 10 slots</small><strong>{draft.title}</strong><small>Review questions & answers → Choose students → Assign</small></span><ArrowRight size={20}/></Link>)}</div></>:<>
 <div className="author-two-columns"><label className="field">Grade<select disabled={busy} value={grade} onChange={e=>setGrade(e.target.value as AuthorDraft['grade'])}>{GRADES.map(g=><option key={g} value={g}>{g==='K'?'Kindergarten':g==='Pre-K'?g:`Grade ${g}`}</option>)}</select></label><label className="field">Subject<select disabled={busy} value={subject} onChange={e=>setSubject(e.target.value as AuthorDraft['subject'])}>{Object.entries(SUBJECTS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
 <p className="muted">Clicking Read with AI sends this file to OpenAI to extract the printed questions and prepare answer keys. Nothing is assigned automatically. Review every result against the original.</p>
 {!aiReady&&<p className="notice">AI reading is not enabled on this server. You can still transcribe the worksheet manually.</p>}
 <button className="primary" disabled={busy||!aiReady} onClick={()=>void create('ai')}><Sparkles size={18}/>{busy?'Reading worksheet… This may take up to 2 minutes.':'Read with AI & create drafts'}</button>
 <button className="secondary" disabled={busy} onClick={()=>void create('manual')}><PenLine size={18}/>Transcribe manually</button>
 <small className="muted">Up to 50 exercises per file, split into worksheets of 10. Fewer than 10? Empty slots stay blank for you to complete.</small>
 </>}
 </section>;
}
