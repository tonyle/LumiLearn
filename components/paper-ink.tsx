"use client";
import { memo, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { pageLayout, paperHeight, paperSvg, type InkStroke, type PaperDraft, type PaperQuestion, type PaperResult } from "@/lib/paper";
export const PaperInk=memo(function PaperInk({ questions, title, pageIndex, draft, results, tool, editable, onChange, onSelect, onWritingChange }: {
  questions: PaperQuestion[]; title: string; pageIndex: number; draft: PaperDraft; results: PaperResult[];
  tool: "pen" | "eraser" | "move"; editable: (id: string) => boolean; onChange: (id: string, stroke: InkStroke) => void; onSelect: (id: string) => void; onWritingChange?: (active:boolean)=>void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  type Cell = ReturnType<typeof pageLayout>[number];
  type Point = InkStroke["points"][number];
  type Active = {id:string;pointerId:number;stroke:InkStroke;cell:Cell;box:DOMRect;remaining:number};
  const current = useRef<Active | null>(null);
  const painted = useRef(new Map<string, InkStroke[]>());
  const layout = useMemo(()=>pageLayout(questions, pageIndex * 10 + 1),[questions,pageIndex]);
  const height = useMemo(()=>paperHeight(questions, pageIndex * 10 + 1),[questions,pageIndex]);
  // Count only when saved ink changes, never in the high-frequency pointer loop.
  const totalPoints = useMemo(()=>Object.values(draft).reduce((n,a)=>n+a.strokes.reduce((m,s)=>m+s.points.length,0),0),[draft]);

  function drawPath(context:CanvasRenderingContext2D,cell:Cell,stroke:InkStroke,points:Point[]) {
    if(!points.length)return;
    context.save();context.beginPath();context.rect(cell.x,cell.y,cell.width,cell.height);context.clip();
    context.globalCompositeOperation=stroke.tool==="eraser"?"destination-out":"source-over";
    context.strokeStyle="#172554";context.lineWidth=stroke.tool==="eraser"?20:2.4;context.lineCap="round";context.lineJoin="round";
    context.beginPath();context.moveTo(cell.x+points[0].x*cell.width,cell.y+points[0].y*cell.height);
    for(let i=1;i<points.length;i++)context.lineTo(cell.x+points[i].x*cell.width,cell.y+points[i].y*cell.height);
    if(points.length===1)context.lineTo(cell.x+points[0].x*cell.width+.1,cell.y+points[0].y*cell.height+.1);
    context.stroke();context.restore();
  }
  // Appending a local stroke must not replay the page. Only Undo/clear/reloaded
  // ink rebuilds the affected question; selection, timer and saving don't paint.
  useEffect(()=>{
    painted.current.clear();
    const canvas=ref.current;canvas?.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);
  },[layout,height]);
  useEffect(()=>{
    const context=ref.current?.getContext("2d");if(!context)return;
    for(const cell of layout){
      const next=draft[cell.question.id]?.strokes??[],previous=painted.current.get(cell.question.id)??[];
      const appended=previous.length<=next.length&&previous.every((stroke,i)=>stroke===next[i]);
      if(appended&&previous.length===next.length)continue;
      if(!appended)context.clearRect(cell.x,cell.y,cell.width,cell.height);
      for(let i=appended?previous.length:0;i<next.length;i++)drawPath(context,cell,next[i],next[i].points);
      painted.current.set(cell.question.id,next);
      const active=current.current;
      if(active?.id===cell.question.id)drawPath(context,cell,active.stroke,active.stroke.points);
    }
    // drawPath is stateless; only authoritative ink/layout changes reconcile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[draft,layout]);
  function point(event:{clientX:number;clientY:number;pressure:number},active:Active):Point {
    const {box,cell}=active;
    return {x:Math.max(0,Math.min(1,((event.clientX-box.left)/box.width*1000-cell.x)/cell.width)),y:Math.max(0,Math.min(1,((event.clientY-box.top)/box.height*height-cell.y)/cell.height)),p:event.pressure||.5};
  }
  function samples(event:React.PointerEvent<HTMLCanvasElement>,includeCoalesced=true){
    const active=current.current;
    if(!active||event.pointerId!==active.pointerId)return;
    const previous=active.stroke.points.at(-1)!;
    // getCoalescedEvents may be absent on Safari or a plain-HTTP LAN connection.
    const batch=includeCoalesced?event.nativeEvent.getCoalescedEvents?.()??[]:[];
    const added:Point[]=[];
    for(const sample of [...batch,event.nativeEvent]){
      if(active.stroke.points.length>=1500||active.remaining<=0)break;
      const next=point(sample,active),last=active.stroke.points.at(-1)!;
      if(Math.hypot((next.x-last.x)*active.cell.width,(next.y-last.y)*active.cell.height)<.35)continue;
      active.stroke.points.push(next);active.remaining--;added.push(next);
    }
    const context=ref.current?.getContext("2d");
    if(context&&added.length)drawPath(context,active.cell,active.stroke,[previous,...added]);
  }
  function finish(event:React.PointerEvent<HTMLCanvasElement>,includeLast=false){
    const active=current.current;if(!active||active.pointerId!==event.pointerId)return;
    if(includeLast)samples(event,false);
    current.current=null;
    painted.current.set(active.id,[...(painted.current.get(active.id)??[]),active.stroke]);
    onWritingChange?.(false);onChange(active.id,active.stroke);
  }
  const background = useMemo(()=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(paperSvg(questions,title,pageIndex,{},false))}`,[questions,title,pageIndex]);
  return <div className="paper-sheet" style={{aspectRatio:`1000 / ${height}`}}>
    <Image src={background} width={1000} height={height} alt={`Worksheet page ${pageIndex+1}: ${questions.length} questions. Write in the answer boxes.`} unoptimized draggable={false} className="paper-background" />
    <canvas ref={ref} width={1000} height={height} className="paper-overlay" aria-label="Worksheet writing surface. Use Pen to write, or Move page to scroll." style={{touchAction:tool==="move"?"pan-x pan-y pinch-zoom":"none",cursor:tool==="move"?"grab":"crosshair"}}
      onPointerDown={event=>{
        if(tool==="move"||current.current||event.button>0)return;
        const box=event.currentTarget.getBoundingClientRect();if(!box.width||!box.height)return;
        const x=(event.clientX-box.left)/box.width*1000,y=(event.clientY-box.top)/box.height*height;
        const cell=layout.find(c=>x>=c.x&&x<=c.x+c.width&&y>=c.y&&y<=c.y+c.height);
        if(!cell||!editable(cell.question.id)||(draft[cell.question.id]?.strokes.length??0)>=200||totalPoints>=20000)return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const active:Active={id:cell.question.id,pointerId:event.pointerId,cell,box,remaining:20000-totalPoints-1,stroke:{tool,points:[]}};
        active.stroke.points.push(point(event,active));current.current=active;
        onSelect(active.id);onWritingChange?.(true);
        const context=ref.current?.getContext("2d");if(context)drawPath(context,cell,active.stroke,active.stroke.points);
      }}
      onPointerMove={event=>samples(event)}
      onPointerUp={event=>finish(event,true)} onPointerCancel={event=>finish(event)} onLostPointerCapture={event=>finish(event)} />
    {layout.map(cell=>{
      const result=results.find(r=>r.questionId===cell.question.id), typed=draft[cell.question.id]?.text;
      return <div key={cell.question.id} className="paper-cell-overlay" style={{left:`${cell.x/10}%`,top:`${cell.y/height*100}%`,width:"45%",height:`${cell.height/height*100}%`}}>
        {typed&&<div className="paper-typed" style={{top:`${(cell.answer.y-cell.y)/cell.height*100}%`,height:`${cell.answer.height/cell.height*100}%`}}>{typed}</div>}
        {result&&<><span className={`paper-mark ${result.status}`} aria-label={`Question ${cell.number}: ${result.status.replace("_"," ")}`}>{result.status==="correct"?"✓ 10/10":result.status==="incorrect"?"✕ 0/10":"? Review"}</span>{result.status==="incorrect"&&<div className="paper-red-border"/>}</>}
      </div>;
    })}
  </div>;
});
