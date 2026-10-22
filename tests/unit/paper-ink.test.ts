// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {PaperInk} from '@/components/paper-ink';
import {pageLayout,paperHeight,type PaperQuestion,type PaperDraft,type InkStroke} from '@/lib/paper';
vi.mock('next/image',()=>({default:()=>null}));
class TestPointerEvent extends MouseEvent{
 readonly pointerId:number;readonly pressure:number;private batch:PointerEvent[];
 constructor(type:string,init:MouseEventInit&{pointerId?:number;pressure?:number;coalesced?:PointerEvent[]}={}){super(type,init);this.pointerId=init.pointerId??1;this.pressure=init.pressure??.5;this.batch=init.coalesced??[];}
 getCoalescedEvents(){return this.batch;}
}
const questions:PaperQuestion[]=Array.from({length:10},(_,i)=>({id:`q${i}`,type:'handwriting',prompt:{text:'Write your answer.'},options:[]}));
const cells=pageLayout(questions,1),cell=cells[0],x=cell.x+40,y=cell.y+80;
const context={clearRect:vi.fn(),save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn()};
function setup(draft:PaperDraft={}){
 const onChange=vi.fn(),onWritingChange=vi.fn();const props={questions,title:'Paper',pageIndex:0,draft,results:[],tool:'pen' as const,editable:()=>true,onSelect:vi.fn(),onChange,onWritingChange};
 const view=render(createElement(PaperInk,props));const canvas=screen.getByLabelText('Worksheet writing surface. Use Pen to write, or Move page to scroll.') as HTMLCanvasElement;
 canvas.setPointerCapture=vi.fn();const bounds=vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1000,height:paperHeight(questions,1)} as DOMRect);
 return {...view,canvas,bounds,props,onChange,onWritingChange};
}
beforeEach(()=>{vi.stubGlobal('PointerEvent',TestPointerEvent);for(const f of Object.values(context))if(vi.isMockFunction(f))f.mockClear();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);});
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
  fireEvent.pointerDown(canvas,{clientX:x+200,clientY:y+50,pointerId:8});fireEvent.pointerMove(canvas,{clientX:x+200,clientY:y+100,pointerId:8});fireEvent.pointerUp(canvas,{pointerId:8});
  fireEvent.pointerMove(canvas,{clientX:x+30,clientY:y+30,pointerId:7,coalesced:[new TestPointerEvent('pointermove',{clientX:x+10,clientY:y+10,pointerId:7}),new TestPointerEvent('pointermove',{clientX:x+20,clientY:y+20,pointerId:7})]});
  fireEvent.pointerUp(canvas,{clientX:x+40,clientY:y+40,pointerId:7});fireEvent.lostPointerCapture(canvas,{pointerId:7});
  expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(5);expect(onChange.mock.calls[0][1].points.at(-1).x).toBeCloseTo(80/cell.width);expect(onWritingChange.mock.calls).toEqual([[true],[false]]);
 });
 it('undo and redo redraw only the changed question, retaining eraser order',()=>{
  const pen:InkStroke={tool:'pen',points:[{x:.1,y:.2,p:.5},{x:.3,y:.4,p:.5}]},eraser:InkStroke={...pen,tool:'eraser'};
  const draft={q0:{text:'',strokes:[pen,eraser]},q1:{text:'',strokes:[pen]}};
  const {rerender,props}=setup(draft);context.clearRect.mockClear();context.stroke.mockClear();
  rerender(createElement(PaperInk,{...props,draft:{...draft,q0:{text:'',strokes:[pen]}}}));
  expect(context.clearRect.mock.calls).toEqual([[cell.x,cell.y,cell.width,cell.height]]);expect(context.stroke).toHaveBeenCalledTimes(1);
  context.stroke.mockClear();rerender(createElement(PaperInk,props));expect(context.clearRect).toHaveBeenCalledTimes(1);expect(context.stroke).toHaveBeenCalledTimes(1);expect((context as unknown as CanvasRenderingContext2D).globalCompositeOperation).toBe('destination-out');
 });
 it('falls back to normal pointer events when coalesced samples are unavailable on HTTP',()=>{
  vi.stubGlobal('PointerEvent',MouseEvent);
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y});fireEvent.pointerMove(canvas,{clientX:x+10,clientY:y+10});fireEvent.pointerUp(canvas,{clientX:x+20,clientY:y+20});
  expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(3);
 });
 it('stays within the server point cap and commits once on pointer cancellation',()=>{
  const {canvas,onChange}=setup();fireEvent.pointerDown(canvas,{clientX:x,clientY:y});for(let i=0;i<1600;i++)fireEvent.pointerMove(canvas,{clientX:x+(i%200),clientY:y+(i%30)});
  fireEvent.pointerCancel(canvas);fireEvent.lostPointerCapture(canvas);expect(onChange).toHaveBeenCalledTimes(1);expect(onChange.mock.calls[0][1].points).toHaveLength(1500);
 });
});
