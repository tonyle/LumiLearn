import type {InkStroke} from './paper';

type Point=InkStroke['points'][number];
type PenState={lastPenAt:number;active?:{owner:symbol;pointerType:string;contactArea:number;end:(commit:boolean)=>void}};
export type InkSurfaceOptions={
 tool:'pen'|'eraser'|'move';editable:boolean;remainingPoints:number;
 onStroke:(stroke:InkStroke)=>void;onWriting:(active:boolean)=>void;
 penState:PenState;
};

/** A small native canvas: no React work, network work or full-page drawing in input handlers. */
export function attachInkSurface(canvas:HTMLCanvasElement,getOptions:()=>InkSurfaceOptions,initial:InkStroke[]=[]){
 const context=canvas.getContext('2d'),owner=Symbol('ink-surface');
 let strokes=initial,active:{pointerId:number;pointerType:string;contactArea:number;stroke:InkStroke;box:DOMRect;remaining:number;painted:number}|null=null;
 let frame:number|null=null,destroyed=false;
 function path(stroke:InkStroke,points:Point[]){
  if(!context||!points.length)return;
  context.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over';
  context.strokeStyle='#172554';context.lineWidth=stroke.tool==='eraser'?20:2.4;context.lineCap='round';context.lineJoin='round';
  context.beginPath();context.moveTo(points[0].x*canvas.width,points[0].y*canvas.height);
  for(let i=1;i<points.length;i++)context.lineTo(points[i].x*canvas.width,points[i].y*canvas.height);
  if(points.length===1)context.lineTo(points[0].x*canvas.width+.1,points[0].y*canvas.height+.1);
  context.stroke();
 }
 function redraw(){context?.clearRect(0,0,canvas.width,canvas.height);for(const stroke of strokes)path(stroke,stroke.points);if(active)path(active.stroke,active.stroke.points);}
 function paintPending(){
  if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  if(!active||active.painted===active.stroke.points.length-1)return;
  path(active.stroke,active.stroke.points.slice(active.painted));active.painted=active.stroke.points.length-1;
 }
 function normalize(sample:PointerEvent,box:DOMRect):Point{return {x:Math.max(0,Math.min(1,(sample.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(sample.clientY-box.top)/box.height)),p:sample.pressure||.5};}
 function collect(event:PointerEvent,coalesced=true){
  if(!active||event.pointerId!==active.pointerId)return;
  const batch=coalesced?event.getCoalescedEvents?.()??[]:[];
  for(const sample of [...batch,event]){
   if(active.stroke.points.length>=1500||active.remaining<=0)break;
   const next=normalize(sample,active.box),last=active.stroke.points.at(-1)!;
   if(Math.hypot((next.x-last.x)*canvas.width,(next.y-last.y)*canvas.height)<.35)continue;
   active.stroke.points.push(next);active.remaining--;
  }
 }
 function release(pointerId:number){try{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);}catch{/* A cancelled OS gesture may already have released capture. */}}
 function finish(includeLast?:PointerEvent){
  if(!active)return;
  if(includeLast)collect(includeLast,false);
  paintPending();const completed=active;active=null;
  strokes=[...strokes,completed.stroke];release(completed.pointerId);
  if(getOptions().penState.active?.owner===owner)delete getOptions().penState.active;
  // Clear input state before notifying the owner: the next down never waits for a render/save.
  const options=getOptions();options.onWriting(false);options.onStroke(completed.stroke);
 }
 function discard(){
  if(!active)return;const previous=active;active=null;if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  release(previous.pointerId);redraw();const options=getOptions();if(options.penState.active?.owner===owner)delete options.penState.active;options.onWriting(false);
 }
 function down(event:PointerEvent){
  let options=getOptions();if(options.tool==='move'||!options.editable||event.button>0)return;
  if(event.pointerType==='touch'&&(event.isPrimary===false&&Math.max(event.width||1,event.height||1)>40||performance.now()-options.penState.lastPenAt<800))return;
  const other=options.penState.active;
  if(other&&other.owner!==owner){
   if(event.pointerType==='touch'&&other.pointerType==='pen')return;
   other.end(!(other.pointerType==='touch'&&(event.pointerType==='pen'||(event.width||1)*(event.height||1)<other.contactArea*.5)));
  }
  if(active){
   if(active.pointerType==='touch'&&(event.pointerType==='pen'||event.pointerType==='touch'&&(event.width||1)*(event.height||1)<active.contactArea*.5)){
    discard(); // Discard a palm contact superseded by a smaller tip or real pen.
   }else if(event.pointerId===active.pointerId||event.isPrimary||event.pointerType===active.pointerType)finish();
   else return;
  }
  options=getOptions();if(options.tool==='move'||!options.editable)return;
  if(event.pointerType==='pen')options.penState.lastPenAt=performance.now();
  if(event.cancelable)event.preventDefault();
  if(strokes.length>=200||options.remainingPoints<1)return;
  const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
  active={pointerId:event.pointerId,pointerType:event.pointerType,contactArea:(event.width||1)*(event.height||1),box,remaining:options.remainingPoints-1,stroke:{tool:options.tool,points:[normalize(event,box)]},painted:0};
  options.penState.active={owner,pointerType:event.pointerType,contactArea:(event.width||1)*(event.height||1),end:commit=>{if(commit)finish();else discard();}};
  try{canvas.setPointerCapture(event.pointerId);}catch{/* Window up/cancel listeners also finish the stroke. */}
  options.onWriting(true);path(active.stroke,active.stroke.points);
 }
 function move(event:PointerEvent){
  if(!active||event.pointerId!==active.pointerId)return;
  if(event.cancelable)event.preventDefault();
  collect(event);if(frame===null)frame=requestAnimationFrame(()=>{frame=null;paintPending();});
 }
 function up(event:PointerEvent){if(active?.pointerId===event.pointerId){if(event.cancelable)event.preventDefault();finish(event);}}
 function cancel(event:PointerEvent){if(active?.pointerId===event.pointerId)finish();}
 function lose(event:PointerEvent){
  // A delayed lost-capture notification from the previous stroke must not end the new one.
  if(active?.pointerId===event.pointerId&&!canvas.hasPointerCapture?.(event.pointerId))finish();
 }
 function blur(){finish();}
 function blockGesture(event:Event){if(getOptions().tool!=='move'&&event.cancelable)event.preventDefault();}
 const nonPassive={passive:false};
 canvas.addEventListener('pointerdown',down,nonPassive);canvas.addEventListener('pointermove',move,nonPassive);
 window.addEventListener('pointerup',up,nonPassive);window.addEventListener('pointercancel',cancel,nonPassive);
 canvas.addEventListener('lostpointercapture',lose);canvas.addEventListener('contextmenu',blockGesture);
 canvas.addEventListener('touchstart',blockGesture,nonPassive);canvas.addEventListener('touchmove',blockGesture,nonPassive);
 window.addEventListener('blur',blur);
 redraw();
 return {
  reconcile(next:InkStroke[]){
   if(destroyed)return;
   const appended=strokes.length<=next.length&&strokes.every((s,i)=>s===next[i]);
   if(appended&&strokes.length===next.length)return;
   const before=strokes.length;strokes=next;
   if(appended){for(let i=before;i<next.length;i++)path(next[i],next[i].points);}else redraw();
  },
  finish:()=>finish(),
  destroy(){
   destroyed=true;if(frame!==null)cancelAnimationFrame(frame);active=null;if(getOptions().penState.active?.owner===owner)delete getOptions().penState.active;
   canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
   window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);
   canvas.removeEventListener('lostpointercapture',lose);canvas.removeEventListener('contextmenu',blockGesture);
   canvas.removeEventListener('touchstart',blockGesture);canvas.removeEventListener('touchmove',blockGesture);window.removeEventListener('blur',blur);
  }
 };
}
