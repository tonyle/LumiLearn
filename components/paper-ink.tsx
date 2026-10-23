"use client";
import {memo,useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import Image from 'next/image';
import {attachInkSurface,type InkSurfaceOptions} from '@/lib/ink-surface';
import {pageLayout,paperHeight,paperSvg,type InkStroke,type PaperDraft,type PaperQuestion,type PaperResult} from '@/lib/paper';
const EMPTY_STROKES:InkStroke[]=[];
type Cell=ReturnType<typeof pageLayout>[number];
type Props={questions:PaperQuestion[];title:string;pageIndex:number;draft:PaperDraft;results:PaperResult[];tool:'pen'|'eraser'|'move';editable:(id:string)=>boolean;onChange:(id:string,stroke:InkStroke)=>void;onSelect:(id:string)=>void;onWritingChange?:(active:boolean)=>void;readDraft?:()=>PaperDraft;onFlushReady?:(flush:(()=>void)|null)=>void};
const QuestionInk=memo(function QuestionInk({cell,height,strokes,tool,editable,onChange,onSelect,onWritingChange,readDraft,penState}:{cell:Cell;height:number;strokes:InkStroke[];penState:React.RefObject<{lastPenAt:number}>}&Pick<Props,'tool'|'editable'|'onChange'|'onSelect'|'onWritingChange'|'readDraft'>){
 const canvas=useRef<HTMLCanvasElement>(null),surface=useRef<ReturnType<typeof attachInkSurface>|null>(null),options=useRef<(InkSurfaceOptions&{readDraft?:()=>PaperDraft})|null>(null);
 useLayoutEffect(()=>{
  options.current={readDraft,tool,editable:editable(cell.question.id),remainingPoints:20000,onStroke:stroke=>onChange(cell.question.id,stroke),onWriting:active=>{if(active)onSelect(cell.question.id);onWritingChange?.(active);},penState:penState.current};
  if(!options.current.editable)surface.current?.finish();
  surface.current?.reconcile(readDraft?.()[cell.question.id]?.strokes??strokes);
 },[cell,strokes,tool,editable,onChange,onSelect,onWritingChange,readDraft,penState]);
 useEffect(()=>{
  if(!canvas.current)return;
  function getOptions():InkSurfaceOptions{
   const current=options.current!;
   const draft=current.readDraft?.();
   const total=draft?Object.values(draft).reduce((n,a)=>n+a.strokes.reduce((m,s)=>m+s.points.length,0),0):0;
   return {...current,remainingPoints:20000-total};
  }
  surface.current=attachInkSurface(canvas.current,getOptions,readDraft?.()[cell.question.id]?.strokes??strokes);
  const instance=surface.current;return()=>{instance.destroy();surface.current=null;};
  // Native listeners stay attached across React renders; live callbacks are read from options.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[cell]);
 return <canvas ref={canvas} width={cell.width} height={cell.height} className="paper-ink-cell" aria-label={`Question ${cell.number} writing surface`} style={{left:`${cell.x/10}%`,top:`${cell.y/height*100}%`,width:'45%',height:`${cell.height/height*100}%`,touchAction:tool==='move'?'pan-x pan-y pinch-zoom':'none',cursor:tool==='move'?'grab':'crosshair'}}/>;
});
export const PaperInk=memo(function PaperInk({questions,title,pageIndex,draft,results,tool,editable,onChange,onSelect,onWritingChange,readDraft,onFlushReady}:Props){
 const layout=useMemo(()=>pageLayout(questions,pageIndex*10+1),[questions,pageIndex]);
 const height=useMemo(()=>paperHeight(questions,pageIndex*10+1),[questions,pageIndex]);
 const penState=useRef<InkSurfaceOptions['penState']>({lastPenAt:-Infinity});
 useLayoutEffect(()=>{onFlushReady?.(()=>penState.current.active?.end(true));return()=>onFlushReady?.(null);},[onFlushReady]);
 const readLive=useMemo(()=>readDraft??(()=>draft),[readDraft,draft]);
 const background=useMemo(()=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(paperSvg(questions,title,pageIndex,{},false))}`,[questions,title,pageIndex]);
 return <div className="paper-sheet" style={{aspectRatio:`1000 / ${height}`}}>
  <Image src={background} width={1000} height={height} alt={`Worksheet page ${pageIndex+1}: ${questions.length} questions. Write in the answer boxes.`} unoptimized draggable={false} className="paper-background"/>
  {layout.map(cell=><QuestionInk key={cell.question.id} cell={cell} height={height} strokes={draft[cell.question.id]?.strokes??EMPTY_STROKES} tool={tool} editable={editable} onChange={onChange} onSelect={onSelect} onWritingChange={onWritingChange} readDraft={readLive} penState={penState}/>)}
  {layout.map(cell=>{const result=results.find(r=>r.questionId===cell.question.id),typed=draft[cell.question.id]?.text;return <div key={cell.question.id} className="paper-cell-overlay" style={{left:`${cell.x/10}%`,top:`${cell.y/height*100}%`,width:'45%',height:`${cell.height/height*100}%`}}>
   {typed&&<div className="paper-typed" style={{top:`${(cell.answer.y-cell.y)/cell.height*100}%`,height:`${cell.answer.height/cell.height*100}%`}}>{typed}</div>}
   {result&&<><span className={`paper-mark ${result.status}`} aria-label={`Question ${cell.number}: ${result.status.replace('_',' ')}`}>{result.status==='correct'?'✓ 10/10':result.status==='incorrect'?'✕ 0/10':'? Review'}</span>{result.status==='incorrect'&&<div className="paper-red-border"/>}</>}
  </div>;})}
 </div>;
});
