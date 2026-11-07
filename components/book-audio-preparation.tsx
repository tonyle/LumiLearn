'use client';
import {useEffect,useState} from 'react';
import type {BookAudioProgress} from '@/lib/book-audio-library';
import {bookJson,bookRequest} from './book-api';
import styles from './book-styles.module.css';
export function BookAudioPreparation({bookId,revision}:{bookId:string;revision:number}){
 const [progress,setProgress]=useState<BookAudioProgress|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const url=`/api/parent/books/${bookId}/audio`;
 useEffect(()=>{let live=true;const load=async()=>{try{const value=await bookRequest<BookAudioProgress>(url);if(live&&typeof value.total==='number'){setProgress(value);setError('');}}catch(e){if(live)setError((e as Error).message);}};void load();const timer=setInterval(()=>void load(),5000);return()=>{live=false;clearInterval(timer);};},[url,revision]);
 async function prepare(){setBusy(true);setError('');try{setProgress(await bookRequest<BookAudioProgress>(url,bookJson({})));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const ready=progress?.state==='ready',waiting=progress?.state==='waiting';
 return <section className={styles.card} aria-label="Book audio"><h2>Listening audio</h2><p>Audio is prepared automatically after text extraction or manual text changes, as a single master recording per passage. Students play saved files at Slow, Gentle or Normal speed without waiting for generation.</p><div aria-live="polite">{!progress?<p>Checking audio preparation…</p>:waiting?<p>Extract text or add text regions first. Audio will then prepare automatically.</p>:<><p className={ready?styles.success:undefined}><strong>{ready?'Ready for instant playback':progress.state==='error'?'Preparation paused · automatically retrying':'Preparing book audio…'}</strong><br/>{progress.ready} / {progress.total} audio files ready · Slow, Gentle and Normal</p><progress aria-label="Audio preparation" max={Math.max(1,progress.total)} value={progress.ready}/>{!ready&&!progress.workerReady&&<p>The background audio worker is starting. Preparation resumes automatically.</p>}</>}{error&&<p className={styles.error}>{error}</p>}</div><button className="secondary" disabled={busy||waiting} onClick={()=>void prepare()}>{busy?'Queuing…':ready?'Check prepared audio':'Prepare / retry audio'}</button><p className={styles.muted}>Saved on your Mac in <code>data/uploads/books/audio</code>. Included in the database + uploads backup. Prepared files are kept permanently, rather than removed as cache.</p></section>;
}
