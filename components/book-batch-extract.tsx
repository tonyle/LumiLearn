'use client';
import {useEffect,useRef,useState} from 'react';
import type {BookPage} from '@/lib/book-contract';
import {bookJson,bookRequest} from './book-api';
import styles from './book-styles.module.css';
type Failure={page:number;message:string};
export function BookBatchExtract({bookId,pages,disabled,onBusy,onComplete}:{bookId:string;pages:BookPage[];disabled:boolean;onBusy:(busy:boolean)=>void;onComplete:()=>Promise<void>}){
 const [running,setRunning]=useState(false),[includeReviewed,setIncludeReviewed]=useState(false),[progress,setProgress]=useState(''),[failures,setFailures]=useState<Failure[]>([]);
 const stop=useRef(false),active=useRef(false);
 useEffect(()=>()=>{stop.current=true;},[]);
 const targets=pages.filter(p=>includeReviewed||!p.reviewed);
 async function start(){
  if(active.current||!targets.length)return;
  active.current=true;stop.current=false;setRunning(true);onBusy(true);setFailures([]);
  let saved=0,attempted=0;const errors:Failure[]=[];
  try{
   for(const page of targets){
    if(stop.current)break;
    setProgress(`Extracting page ${page.page_number} · ${attempted+1} of ${targets.length}`);
    try{
     const {page:updated}=await bookRequest<{page:BookPage}>(`/api/parent/books/${bookId}/pages/${page.id}/extract`,bookJson({key:crypto.randomUUID(),autoReview:true}));
     if(updated.reviewed)saved++;
     else errors.push({page:page.page_number,message:'No readable text was found. Add text manually or retry with a clearer image.'});
    }catch(error){errors.push({page:page.page_number,message:(error as Error).message});}
    attempted++;setFailures([...errors]);
   }
   setProgress(`${saved} page${saved===1?'':'s'} extracted and marked reviewed. ${errors.length} need attention.${stop.current?' Stopped; finished pages are saved.':''}`);
  }finally{
   try{await onComplete();}catch(error){setFailures(current=>[...current,{page:0,message:`Refresh the book to see saved pages. ${(error as Error).message}`}]);}
   active.current=false;setRunning(false);onBusy(false);
  }
 }
 return <div className={styles.bulkExtract}>
  <div><h3>Extract the book in one step</h3><p className={styles.muted}>Read page images with OpenAI and automatically mark pages with text as reviewed. You can correct text and positions later. This uses your AI budget; the book stays unpublished until you publish it.</p></div>
  <label className={styles.actions}><input type="checkbox" checked={includeReviewed} disabled={disabled||running} onChange={e=>setIncludeReviewed(e.target.checked)}/>Include reviewed pages and replace their saved text</label>
  <div className={styles.actions}><button type="button" className="primary" disabled={disabled||running||!targets.length} onClick={()=>void start()}>Extract {targets.length} page{targets.length===1?'':'s'} & mark reviewed</button>{running&&<button type="button" className="secondary" onClick={()=>{stop.current=true;setProgress('Stopping after the current page…');}}>Stop after this page</button>}</div>
  {progress&&<p role="status" aria-live="polite">{progress}</p>}
  {!running&&targets.length===0&&<p className={styles.muted}>All pages are reviewed. Select a page to edit it, or enable replacing reviewed pages to extract again.</p>}
  {failures.length>0&&<details open={!running}><summary>{failures.length} page{failures.length===1?'':'s'} need attention</summary><ul>{failures.map((f,i)=><li key={i}>{f.page>0?`Page ${f.page}: `:''}{f.message}</li>)}</ul></details>}
  {running&&<p className={styles.muted}>Keep this tab open. Each completed page is saved immediately. Retry later to process the remaining unreviewed pages.</p>}
 </div>;
}
