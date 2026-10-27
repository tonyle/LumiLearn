// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {PaperInk} from '@/components/paper-ink';
import {pageLayout,type PaperQuestion,type PaperDraft,type InkStroke} from '@/lib/paper';
vi.mock('next/image',()=>({default:()=>null}));
class TestPointerEvent extends MouseEvent{
 readonly pointerId:number;readonly pointerType:string;readonly isPrimary:boolean;readonly width:number;readonly height:number;readonly pressure:number;private batch:PointerEvent[];
 constructor(type:string,init:MouseEventInit&{pointerId?:number;pointerType?:string;isPrimary?:boolean;width?:number;height?:number;pressure?:number;coalesced?:PointerEvent[]}={}){super(type,init);this.pointerId=init.pointerId??1;this.pointerType=init.pointerType??'pen';this.isPrimary=init.isPrimary??true;this.width=init.width??1;this.height=init.height??1;this.pressure=init.pressure??.5;this.batch=init.coalesced??[];}
 getCoalescedEvents(){return this.batch;}
}
const questions:PaperQuestion[]=Array.from({length:10},(_,i)=>({id:`q${i}`,type:'handwriting',prompt:{text:'Write your answer.'},options:[]}));
const cells=pageLayout(questions,1),cell=cells[0],x=cell.x+40,y=cell.y+80;
const context={clearRect:vi.fn(),save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn()};
function setup(draft:PaperDraft={}){
 const onChange=vi.fn(),onWritingChange=vi.fn();const props={questions,title:'Paper',pageIndex:0,draft,results:[],tool:'pen' as const,editable:()=>true,onSelect:vi.fn(),onChange,onWritingChange};
 const view=render(createElement(PaperInk,props));const canvas=screen.getByLabelText('Question 1 writing surface') as HTMLCanvasElement;
 canvas.setPointerCapture=vi.fn();const bounds=vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:cell.x,top:cell.y,width:cell.width,height:cell.height} as DOMRect);
 return {...view,canvas,bounds,props,onChange,onWritingChange};
}
beforeEach(()=>{vi.stubGlobal('PointerEvent',TestPointerEvent);vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());for(const f of Object.values(context))if(vi.isMockFunction(f))f.mockClear();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('low-latency worksheet ink',()=>{
 it('keeps completed ink on the canvas without replaying it after each pen lift',()=>{
  const {canvas,rerender,props,onChange,onWritingChange}=setup();const initialClears=context.clearRect.mock.calls.length;
  fireEvent.pointerDown(canvas,{clientX:x,clientY:y});fireEvent.pointerMove(canvas,{clientX:x+10,clientY:y+10});
  rerender(createElement(PaperInk,{...props,draft:{q1:{text:'Typing elsewhere',strokes:[]}}}));
  fireEvent.pointerMove(canvas,{clientX:x+20,clientY:y+20});fireEvent.pointerUp(canvas,{clientX:x+20,clientY:y+20});
  const strokes=context.stroke.mock.calls.length;
  rerender(createElement(PaperInk,{...props,draft:{q0:{text:'',strokes:[onChange.mock.calls[0][1]]}}}));
  expect(context.clearRect).toHaveBeenCalledTimes(initialClears);expect(context.stroke).toHaveBeenCalledTimes(strokes);
  expect(onWritingChange.mock.calls).toEqual([[true],[false]]);expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(3);
 });
 it('does one layout read for a fast stroke even with 10,000 existing ink points',()=>{
  const stroke:InkStroke={tool:'pen',points:Array.from({length:100},(_,i)=>({x:i/100,y:.5,p:.5}))};
  const draft=Object.fromEntries(questions.map(q=>[q.id,{text:'',strokes:Array.from({length:10},()=>stroke)}]));
  const {canvas,bounds,onChange,rerender,props}=setup(draft);context.clearRect.mockClear();context.stroke.mockClear();
  fireEvent.pointerDown(canvas,{clientX:x,clientY:y});
  for(let i=1;i<=200;i++)fireEvent.pointerMove(canvas,{clientX:x+i,clientY:y+Math.sin(i/10)*10});
  fireEvent.pointerUp(canvas,{clientX:x+200,clientY:y+Math.sin(20)*10});
  const calls=context.stroke.mock.calls.length;
  rerender(createElement(PaperInk,{...props,draft:{...draft,q0:{text:'',strokes:[...draft.q0.strokes,onChange.mock.calls[0][1]]}}}));
  expect(bounds).toHaveBeenCalledTimes(1);expect(context.clearRect).not.toHaveBeenCalled();expect(context.stroke).toHaveBeenCalledTimes(calls);expect(onChange.mock.calls[0][1].points).toHaveLength(201);
 });
 it('retains coalesced samples and the last point on pen-up while ignoring other pointers',()=>{
  const {canvas,onChange,onWritingChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId:7});
  fireEvent.pointerDown(canvas,{clientX:x+200,clientY:y+50,pointerId:8,pointerType:'touch',isPrimary:false});fireEvent.pointerMove(canvas,{clientX:x+200,clientY:y+100,pointerId:8,pointerType:'touch',isPrimary:false});fireEvent.pointerUp(canvas,{pointerId:8,pointerType:'touch',isPrimary:false});
  fireEvent.pointerMove(canvas,{clientX:x+30,clientY:y+30,pointerId:7,coalesced:[new TestPointerEvent('pointermove',{clientX:x+10,clientY:y+10,pointerId:7}),new TestPointerEvent('pointermove',{clientX:x+20,clientY:y+20,pointerId:7})]});
  fireEvent.pointerUp(canvas,{clientX:x+40,clientY:y+40,pointerId:7});fireEvent.lostPointerCapture(canvas,{pointerId:7});
  expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(5);expect(onChange.mock.calls[0][1].points.at(-1).x).toBeCloseTo(80/cell.width);expect(onWritingChange.mock.calls).toEqual([[true],[false]]);
 });
 it('undo and redo redraw only the changed question, retaining eraser order',()=>{
  const pen:InkStroke={tool:'pen',points:[{x:.1,y:.2,p:.5},{x:.3,y:.4,p:.5}]},eraser:InkStroke={...pen,tool:'eraser'};
  const draft={q0:{text:'',strokes:[pen,eraser]},q1:{text:'',strokes:[pen]}};
  const {rerender,props}=setup(draft);context.clearRect.mockClear();context.stroke.mockClear();
  rerender(createElement(PaperInk,{...props,draft:{...draft,q0:{text:'',strokes:[pen]}}}));
  expect(context.clearRect.mock.calls).toEqual([[0,0,cell.width,cell.height]]);expect(context.stroke).toHaveBeenCalledTimes(1);
  context.stroke.mockClear();rerender(createElement(PaperInk,props));expect(context.clearRect).toHaveBeenCalledTimes(1);expect(context.stroke).toHaveBeenCalledTimes(1);expect((context as unknown as CanvasRenderingContext2D).globalCompositeOperation).toBe('destination-out');
 });
 it('falls back to normal pointer events when coalesced samples are unavailable on HTTP',()=>{
  vi.stubGlobal('PointerEvent',MouseEvent);
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y});fireEvent.pointerMove(canvas,{clientX:x+10,clientY:y+10});fireEvent.pointerUp(canvas,{clientX:x+20,clientY:y+20});
  expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(3);
 });
 it('accepts 100 consecutive short strokes without waiting for React or an animation frame',()=>{
  const {canvas,onChange,bounds}=setup();context.clearRect.mockClear();
  for(let i=0;i<100;i++){
   fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId:7});fireEvent.pointerMove(canvas,{clientX:x+4,clientY:y+5,pointerId:7});fireEvent.pointerUp(canvas,{clientX:x+8,clientY:y+10,pointerId:7});
  }
  expect(onChange).toHaveBeenCalledTimes(100);expect(bounds).toHaveBeenCalledTimes(100);expect(context.clearRect).not.toHaveBeenCalled();
  for(const call of onChange.mock.calls)expect(call[1].points).toHaveLength(3);
 });
 it('recovers the next letter if the previous pen-up was lost',()=>{
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId:7});fireEvent.pointerMove(canvas,{clientX:x+10,clientY:y+10,pointerId:7});
  fireEvent.pointerDown(canvas,{clientX:x+40,clientY:y,pointerId:7});fireEvent.pointerUp(canvas,{clientX:x+50,clientY:y+10,pointerId:7});
  expect(onChange).toHaveBeenCalledTimes(2);expect(onChange.mock.calls[0][1].points).toHaveLength(2);expect(onChange.mock.calls[1][1].points).toHaveLength(2);
 });
 it('gives a real pen priority over an existing palm contact',()=>{
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId:2,pointerType:'touch'});
  fireEvent.pointerDown(canvas,{clientX:x+20,clientY:y,pointerId:7,pointerType:'pen'});fireEvent.pointerUp(canvas,{clientX:x+30,clientY:y+10,pointerId:7});
  fireEvent.pointerUp(canvas,{clientX:x,clientY:y,pointerId:2,pointerType:'touch'});expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points[0].x).toBeCloseTo(60/cell.width);
 });
 it('ignores 100 finger contacts without creating any ink or writing callbacks',()=>{
  const {canvas,onChange,onWritingChange,bounds}=setup();
  for(let i=0;i<100;i++){const pointerId=i+10;fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId,pointerType:'touch'});fireEvent.pointerUp(canvas,{clientX:x+8,clientY:y+10,pointerId,pointerType:'touch'});}
  expect(onChange).not.toHaveBeenCalled();expect(onWritingChange).not.toHaveBeenCalled();expect(bounds).not.toHaveBeenCalled();
 });
 it('ignores overlapping finger gestures even when a touch-up is missed',()=>{
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y,pointerId:10,pointerType:'touch'});fireEvent.pointerMove(canvas,{clientX:x+10,clientY:y+10,pointerId:10,pointerType:'touch'});
  fireEvent.pointerDown(canvas,{clientX:x+30,clientY:y,pointerId:11,pointerType:'touch',isPrimary:false});fireEvent.pointerUp(canvas,{clientX:x+40,clientY:y+10,pointerId:11,pointerType:'touch',isPrimary:false});
  fireEvent.pointerUp(canvas,{pointerId:10,pointerType:'touch'});expect(onChange).not.toHaveBeenCalled();
 });
 it('blocks native touch gestures in both writing and Move mode',()=>{
  const {canvas,rerender,props}=setup();expect(fireEvent.touchStart(canvas,{cancelable:true})).toBe(false);expect(fireEvent.touchMove(canvas,{cancelable:true})).toBe(false);
  rerender(createElement(PaperInk,{...props,tool:'move'}));expect(fireEvent.touchStart(canvas,{cancelable:true})).toBe(false);expect(canvas.style.touchAction).toBe('none');
  fireEvent.pointerDown(canvas,{clientX:x,clientY:y});expect(props.onChange).not.toHaveBeenCalled();
 });

 it('allows pen/mouse page dragging in Move mode but ignores fingers without drawing or saving',()=>{
  const {canvas,rerender,props,onChange,onWritingChange}=setup();rerender(createElement(PaperInk,{...props,tool:'move'}));
  const viewport=canvas.closest('.paper-sheet')!.parentElement!;viewport.style.overflow='auto';
  vi.spyOn(viewport,'scrollWidth','get').mockReturnValue(900);vi.spyOn(viewport,'clientWidth','get').mockReturnValue(450);vi.spyOn(viewport,'scrollHeight','get').mockReturnValue(1000);vi.spyOn(viewport,'clientHeight','get').mockReturnValue(500);viewport.scrollLeft=150;viewport.scrollTop=100;
  fireEvent.pointerDown(canvas,{pointerType:'touch',pointerId:2,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{pointerType:'touch',pointerId:2,clientX:50,clientY:60});fireEvent.pointerUp(canvas,{pointerType:'touch',pointerId:2});
  expect(viewport.scrollLeft).toBe(150);expect(viewport.scrollTop).toBe(100);
  for(const pointerType of ['pen','mouse']){fireEvent.pointerDown(canvas,{pointerType,pointerId:7,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{pointerType,pointerId:7,clientX:50,clientY:60});fireEvent.pointerUp(canvas,{pointerType,pointerId:7});}
  expect(viewport.scrollLeft).toBe(250);expect(viewport.scrollTop).toBe(180);expect(onChange).not.toHaveBeenCalled();expect(onWritingChange).not.toHaveBeenCalled();
 });
 it('moves the document vertically when the zoom viewport has only horizontal overflow',()=>{
  const {canvas,rerender,props,onChange}=setup();rerender(createElement(PaperInk,{...props,tool:'move'}));const viewport=canvas.closest('.paper-sheet')!.parentElement!;viewport.style.overflow='auto';
  vi.spyOn(viewport,'scrollWidth','get').mockReturnValue(900);vi.spyOn(viewport,'clientWidth','get').mockReturnValue(450);vi.spyOn(viewport,'scrollHeight','get').mockReturnValue(500);vi.spyOn(viewport,'clientHeight','get').mockReturnValue(500);
  const root=document.documentElement;vi.spyOn(root,'scrollHeight','get').mockReturnValue(2000);vi.spyOn(root,'clientHeight','get').mockReturnValue(600);root.scrollTop=100;
  fireEvent.pointerDown(canvas,{pointerType:'pen',pointerId:7,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{pointerType:'pen',pointerId:7,clientX:50,clientY:40});fireEvent.pointerUp(canvas,{pointerType:'pen',pointerId:7});
  expect(viewport.scrollLeft).toBe(50);expect(viewport.scrollTop).toBe(0);expect(root.scrollTop).toBe(160);expect(onChange).not.toHaveBeenCalled();root.scrollTop=0;
 });
 it('ignores fingers in Eraser mode and lets a pen erase normally',()=>{
  const {canvas,rerender,props,onChange}=setup();rerender(createElement(PaperInk,{...props,tool:'eraser'}));
  fireEvent.pointerDown(canvas,{pointerType:'touch',pointerId:2,clientX:x,clientY:y});fireEvent.pointerMove(canvas,{pointerType:'touch',pointerId:2,clientX:x+10,clientY:y+10});fireEvent.pointerUp(canvas,{pointerType:'touch',pointerId:2});expect(onChange).not.toHaveBeenCalled();
  fireEvent.pointerDown(canvas,{pointerType:'pen',pointerId:7,clientX:x,clientY:y});fireEvent.pointerUp(canvas,{pointerType:'pen',pointerId:7,clientX:x+10,clientY:y+10});expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].tool).toBe('eraser');
 });
 it('uses a question-sized backing canvas and batches movement drawing once per frame',()=>{
  const {canvas,onChange}=setup();expect(canvas.width).toBe(450);expect(canvas.height).toBe(cell.height);context.stroke.mockClear();
  fireEvent.pointerDown(canvas,{clientX:x,clientY:y});for(let i=1;i<=20;i++)fireEvent.pointerMove(canvas,{clientX:x+i,clientY:y+i});
  expect(context.stroke).toHaveBeenCalledTimes(1);expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(canvas,{clientX:x+20,clientY:y+20});expect(context.stroke).toHaveBeenCalledTimes(2);expect(onChange.mock.calls[0][1].points).toHaveLength(21);
 });
 it('stays within the server point cap and commits once on pointer cancellation',()=>{
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y});for(let i=0;i<1600;i++)fireEvent.pointerMove(canvas,{clientX:x+(i%200),clientY:y+(i%30)});
  fireEvent.pointerCancel(canvas);fireEvent.lostPointerCapture(canvas);expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(1500);
 });
});
