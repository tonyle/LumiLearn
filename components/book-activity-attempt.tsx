'use client';
import {useState} from 'react';
import type {BookDetail} from '@/lib/book-contract';
import type {ActivityAttempt,ActivityPart,BookActivity} from '@/lib/book-activity-contract';
import {BookActivityCanvas} from './book-activity-canvas';
import styles from './book-activities.module.css';
export function BookActivityAttemptViewer({detail,attempt,activity,onClose}:{detail:BookDetail;attempt:ActivityAttempt;activity:BookActivity;onClose:()=>void}){
 const [index,setIndex]=useState(0),snapshot=attempt.activitySnapshot??activity,part=snapshot.parts[index],page=attempt.pageSnapshot?.find(p=>p.id===part?.pageId)??detail.pages.find(p=>p.id===part?.pageId);
 return <section className={`${styles.room} ${styles.savedAttempt}`} aria-label="Saved activity submission"><header className={styles.bar}><button onClick={onClose}>← Close saved submission</button><h1>{snapshot.title} · {new Date(attempt.created_at).toLocaleString()}</h1><strong>{attempt.earned}/{attempt.maximum}</strong></header><div className={styles.instructions}><p>{snapshot.instructions}</p><nav aria-label="Saved answer areas">{snapshot.parts.map((p,i)=><button key={p.id} aria-pressed={i===index} onClick={()=>setIndex(i)}>{p.label}</button>)}</nav></div>{part&&page?<div className={styles.canvasStage}><BookActivityCanvas key={part.id} part={{...part,rubric:''} as ActivityPart} imageUrl={`/api/books/${detail.book.id}/activities/${activity.id}/attempts/${attempt.id}/pages/${part.pageId}/image`} pageWidth={page.width} pageHeight={page.height} answer={attempt.draft[part.id]??{strokes:[],text:''}} onChange={()=>{}} readOnly/></div>:<p>This original book page is no longer available. The saved answers and grading feedback are retained.</p>}<div className={styles.history}>{attempt.results.map(r=><div key={r.partId}><strong>{snapshot.parts.find(p=>p.id===r.partId)?.label} · {r.points===null?'Needs review':`${r.points}/${r.maximum}`}</strong><p>{r.feedback}</p></div>)}</div></section>;
}
