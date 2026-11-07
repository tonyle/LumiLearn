'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ActivityAnswer,ActivityPart,ActivityStroke} from '@/lib/book-activity-contract';
import {appendActivityStroke,loadActivityImage,paintActivityFill,paintActivityInk,paintActivityText,snapshotSize} from '@/lib/book-activity-drawing';
import styles from './book-activity-canvas.module.css';
import {attachActivityInkSurface} from '@/lib/book-activity-ink-surface';
export {renderActivityInkPng} from '@/lib/book-activity-drawing';
type Props={imageUrl:string;pageWidth:number;pageHeight:number;part:ActivityPart;answer:ActivityAnswer;onChange:(answer:ActivityAnswer)=>void;readOnly?:boolean;onWritingChange?:(writing:boolean)=>void;pointLimit?:number;onFlushReady?:(flush:(()=>void)|null)=>void};
const tools:ActivityStroke['tool'][]=['pen','brush','highlighter','eraser','line','rectangle','ellipse','fill'];
export function BookActivityCanvas({imageUrl,pageWidth,pageHeight,part,answer,onChange,readOnly=false,onWritingChange,pointLimit=40000,onFlushReady}:Props){
 const [mode,setMode]=useState(part.kind),[keyboard,setKeyboard]=useState(false),[tool,setTool]=useState<ActivityStroke['tool']>('pen'),[color,setColor]=useState('#172554'),[width,setWidth]=useState(4),[focus,setFocus]=useState(false),[moving,setMoving]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<ActivityAnswer[]>([]),[redo,setRedo]=useState<ActivityAnswer[]>([]);
 const canvasRef=useRef<HTMLCanvasElement>(null),previewRef=useRef<HTMLCanvasElement>(null),textRef=useRef<HTMLCanvasElement>(null),imageRef=useRef<HTMLImageElement|null>(null),surface=useRef<ReturnType<typeof attachActivityInkSurface>|null>(null),current=useRef(answer),ownAnswers=useRef(new WeakSet<ActivityAnswer>()),options=useRef({tool,color,width,readOnly,keyboard,mode,moving,pointLimit}),change=useRef(onChange),writing=useRef(onWritingChange),flushReady=useRef(onFlushReady),historyRef=useRef<ActivityAnswer[]>([]),redoRef=useRef<ActivityAnswer[]>([]);
 useLayoutEffect(()=>{options.current={tool,color,width,readOnly,keyboard,mode,moving,pointLimit};change.current=onChange;writing.current=onWritingChange;flushReady.current=onFlushReady;});
 function adopt(next:ActivityAnswer,replace=false){current.current=next;ownAnswers.current.add(next);if(replace)surface.current?.reconcile(next.strokes,true);change.current(next);}
 function commit(next:ActivityAnswer){if(next===current.current)return;historyRef.current=[...historyRef.current,current.current].slice(-100);setHistory(historyRef.current);redoRef.current=[];setRedo([]);adopt(next);}
 const commitRef=useRef(commit);useLayoutEffect(()=>{commitRef.current=commit;});
 useLayoutEffect(()=>{if(answer===current.current||ownAnswers.current.has(answer))return;current.current=answer;surface.current?.reconcile(answer.strokes,true);},[answer]);
 useEffect(()=>{const canvas=canvasRef.current,preview=previewRef.current;if(!canvas||!preview)return;
  const engine=attachActivityInkSurface(canvas,preview,()=>{const o=options.current;return{tool:o.mode==='write'&&o.tool!=='eraser'?'pen':o.tool,color:o.color,width:o.width,editable:!o.readOnly&&!o.moving&&!(o.keyboard&&o.mode==='write'),ready:!!imageRef.current,pointLimit:o.pointLimit,onStroke:stroke=>commitRef.current(appendActivityStroke(current.current,stroke)),onWriting:active=>writing.current?.(active),onFull:()=>setError('This answer is full. Undo or clear some ink to continue.')}},strokes=>{if(imageRef.current)paintActivityInk(canvas,{strokes,text:''},imageRef.current,part,false);},stroke=>{if(imageRef.current)paintActivityFill(canvas,stroke,imageRef.current,part);},current.current.strokes);
  surface.current=engine;flushReady.current?.(engine.finish);let alive=true;imageRef.current=null;loadActivityImage(imageUrl).then(image=>{if(!alive)return;imageRef.current=image;engine.reconcile(current.current.strokes,true);}).catch(()=>{if(alive)setError('The page could not load. Reload to continue.');});return()=>{alive=false;engine.destroy();surface.current=null;flushReady.current?.(null);imageRef.current=null;writing.current?.(false);};
 },[imageUrl,part]);
 useEffect(()=>{const canvas=textRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);if(!(keyboard&&mode==='write'))paintActivityText(ctx,current.current.text,part.lines);},[answer.text,keyboard,mode,part]);
 const size=snapshotSize(pageWidth*part.width,pageHeight*part.height),lineHeight=100/(part.lines+1);
 return <section className={styles.root} aria-label={`${part.label} answer canvas`}>
 <div className={styles.toolbar} aria-label="Answer tools">
 <button type="button" aria-pressed={mode==='draw'} onClick={()=>setMode('draw')}>Draw</button><button type="button" aria-pressed={mode==='write'} onClick={()=>{setMode('write');setTool('pen');}}>Write</button>
 {mode==='write'?<><button type="button" aria-pressed={!keyboard} onClick={()=>{setKeyboard(false);setTool('pen');}}>Write with pen</button><button type="button" disabled={readOnly} aria-pressed={!keyboard&&tool==='eraser'} onClick={()=>{setKeyboard(false);setTool('eraser');}}>Eraser</button><button type="button" aria-pressed={keyboard} onClick={()=>setKeyboard(true)}>Keyboard</button></>:tools.map(t=><button disabled={readOnly} type="button" key={t} aria-pressed={tool===t} onClick={()=>setTool(t)}>{t}</button>)}
 {(mode==='draw'||!keyboard)&&<>{['#172554','#dc2626','#2563eb','#16a34a','#eab308','#9333ea'].map(swatch=><button key={swatch} type="button" disabled={readOnly} aria-label={`Use color ${swatch}`} aria-pressed={color===swatch} style={{background:swatch,color:'#fff',width:30,height:30,padding:0}} onClick={()=>setColor(swatch)}>{color===swatch?'✓':''}</button>)}
 <label>Custom color <input type="color" value={color} disabled={readOnly} onChange={e=>setColor(e.target.value)}/></label>
 <label>Width <input aria-label="Stroke width" type="range" min="1" max="80" value={width} disabled={readOnly} onChange={e=>setWidth(Number(e.target.value))}/>{width}</label></>}
 <button type="button" disabled={readOnly||!history.length} onClick={()=>{surface.current?.finish();const previous=historyRef.current.at(-1);if(!previous)return;redoRef.current=[...redoRef.current,current.current];historyRef.current=historyRef.current.slice(0,-1);setRedo(redoRef.current);setHistory(historyRef.current);adopt(previous,true);}}>Undo</button>
 <button type="button" disabled={readOnly||!redo.length} onClick={()=>{surface.current?.finish();const next=redoRef.current.at(-1);if(!next)return;historyRef.current=[...historyRef.current,current.current];redoRef.current=redoRef.current.slice(0,-1);setHistory(historyRef.current);setRedo(redoRef.current);adopt(next,true);}}>Redo</button>
 <button type="button" disabled={readOnly||(!answer.strokes.length&&!answer.text)} onClick={()=>{surface.current?.finish();if(window.confirm('Clear all ink and typed text in this answer?')){commit({strokes:[],text:''});surface.current?.reconcile([],true);}}}>Clear</button>
 <button type="button" aria-pressed={moving} onClick={()=>setMoving(!moving)}>Move & zoom</button>
 <button type="button" aria-pressed={focus} onClick={()=>setFocus(!focus)}>{focus?'Fit full page':'Focus answer'}</button>
 </div>
 <p className={styles.hint}>{readOnly?'Saved answer':moving?'Move mode: scroll or zoom the page. Turn Move off to write or draw.':keyboard&&mode==='write'?'Type in the answer area. Your ink is kept.':'Use a pen or mouse in the outlined area. Touch is ignored inside the answer area; scroll outside it.'}</p>
 {error&&<p role="alert">{error}</p>}
 <div className={styles.viewport}>
 <div className={styles.page} style={{aspectRatio:`${pageWidth}/${pageHeight}`,width:focus?`${100/part.width}%`:'100%',marginLeft:focus?`${-part.x/part.width*100}%`:0,marginTop:focus?`${-part.y/part.width*(pageHeight/pageWidth)*100}%`:0}}>
 {/* A full-page reference image preserves surrounding question context. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={imageUrl} alt="Original activity page" draggable={false}/>
 <div className={styles.region} style={{left:`${part.x*100}%`,top:`${part.y*100}%`,width:`${part.width*100}%`,height:`${part.height*100}%`}}>
 {mode==='write'&&<div aria-hidden className={styles.guides} style={{backgroundSize:`100% ${lineHeight}%`}}/>}
 <canvas ref={previewRef} width={size.width} height={size.height} className={styles.liveInk} aria-hidden="true"/>
 <canvas ref={textRef} width={size.width} height={size.height} className={styles.typedInk} aria-hidden="true"/>
 <canvas ref={canvasRef} width={size.width} height={size.height} aria-label="Draw your answer" className={styles.canvas} style={{pointerEvents:moving?'none':'auto'}}/>
 {mode==='write'&&keyboard&&<textarea aria-label="Typed answer" value={answer.text} readOnly={readOnly} maxLength={4000} spellCheck className={styles.text} style={{pointerEvents:moving?'none':'auto',paddingTop:`${35/(part.lines+1)}cqh`,lineHeight:`${100/(part.lines+1)}cqh`,fontSize:`min(${65/(part.lines+1)}cqh, 3.5cqw)`}} onChange={e=>commit({...current.current,text:e.target.value})}/>}
 </div></div></div>
 </section>;
}
