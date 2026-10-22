// @vitest-environment jsdom
import {createElement} from "react";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {PaperPlayer} from "@/components/paper-player";
import type {PaperQuestion} from "@/lib/paper";
const inkRenderCount=vi.hoisted(()=>({value:0}));
vi.mock("@/hooks/use-study-timer",()=>({useStudyTimer:()=>({clock:{state:"running",elapsedMs:0,started:true,serverNow:Date.now(),leaseUntil:Date.now()+45000},loading:false,error:"",pause:vi.fn(),resume:vi.fn().mockResolvedValue(undefined),apply:vi.fn()})}));
vi.mock("next/link",()=>({default:"a"}));
vi.mock("@/components/paper-ink",()=>({PaperInk:({questions,onChange,onWritingChange}:{questions:PaperQuestion[];onChange:(id:string,stroke:unknown)=>void;onWritingChange?:(active:boolean)=>void})=>{inkRenderCount.value++;return createElement("button",{onPointerDown:()=>onWritingChange?.(true),onPointerUp:()=>onWritingChange?.(false),onClick:()=>onChange(questions[0].id,{tool:"pen",points:[{x:.2,y:.3,p:.5}]})},`Draw on ${questions.length}-question paper`);}}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const questions=Array.from({length:12},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,type:"number",prompt:{text:`Question ${index+1}`},options:[]}));
describe("paper player",()=>{
 it("keeps drawing while saving and sends new ink with the next revision",async()=>{
  let finishFirst:(value:unknown)=>void=()=>{};
  const firstSave=new Promise(resolve=>{finishFirst=resolve;});
  let writes=0;
  const fetcher=vi.fn().mockImplementation(async(_url,options)=>{
   if(options?.method==="PUT"){writes++;if(writes===1)return firstSave;return {ok:true,json:async()=>({data:{revision:writes}})};}
   return {ok:true,json:async()=>({data:{revision:0,draft:{},feedback:null}})};
  });
  vi.stubGlobal("fetch",fetcher);render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false}));
  const pen=await screen.findByText("Draw on 10-question paper");vi.useFakeTimers();
  fireEvent.click(pen);await act(async()=>{await vi.advanceTimersByTimeAsync(250);});await act(async()=>{await vi.advanceTimersByTimeAsync(1799);});expect(writes).toBe(0);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(writes).toBe(1);expect(screen.getByText("Saving in background…")).toBeTruthy();
  fireEvent.click(pen);expect((screen.getByRole("button",{name:"Pen"}) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("button",{name:"Submit whole page"}) as HTMLButtonElement).disabled).toBe(false);
  await act(async()=>{finishFirst({ok:true,json:async()=>({data:{revision:1}})});});
  expect(screen.getByText("Waiting to save…")).toBeTruthy();
  await act(async()=>{await vi.advanceTimersByTimeAsync(250);});await act(async()=>{await vi.advanceTimersByTimeAsync(1800);});
  const requests=fetcher.mock.calls.filter(call=>call[1]?.method==="PUT");expect(requests).toHaveLength(2);
  const second=JSON.parse(requests[1][1].body);expect(second.baseRevision).toBe(1);expect(second.draft[questions[0].id].strokes).toHaveLength(2);expect(screen.getByText("Saved")).toBeTruthy();
 });
 it("defers autosave while a pen stroke is active and saves all ink after the next idle pause",async()=>{
  const fetcher=vi.fn().mockImplementation(async(_url,options)=>({ok:true,json:async()=>options?.method==="PUT"?{data:{revision:1}}:{data:{revision:0,draft:{},feedback:null}}}));vi.stubGlobal("fetch",fetcher);
  render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false}));const pen=await screen.findByText("Draw on 10-question paper");vi.useFakeTimers();
  fireEvent.click(pen);fireEvent.pointerDown(pen);await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});expect(fetcher.mock.calls.filter(c=>c[1]?.method==="PUT")).toHaveLength(0);
  fireEvent.pointerUp(pen);fireEvent.click(pen);await act(async()=>{await vi.advanceTimersByTimeAsync(250);});await act(async()=>{await vi.advanceTimersByTimeAsync(1800);});const writes=fetcher.mock.calls.filter(c=>c[1]?.method==="PUT");expect(writes).toHaveLength(1);expect(JSON.parse(writes[0][1].body).draft[questions[0].id].strokes).toHaveLength(2);
 });
 it("does not render the worksheet again between rapid letters and submits the latest ink before UI catches up",async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:0,draft:{},feedback:null}})});vi.stubGlobal("fetch",fetcher);
  render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false}));const pen=await screen.findByText("Draw on 10-question paper");vi.useFakeTimers();const renders=inkRenderCount.value;
  for(let i=0;i<60;i++){fireEvent.pointerDown(pen);fireEvent.pointerUp(pen);fireEvent.click(pen);await act(async()=>{await vi.advanceTimersByTimeAsync(30);});}
  expect(inkRenderCount.value).toBe(renders);expect(fetcher.mock.calls.some(c=>c[1]?.method==="PUT")).toBe(false);
  fireEvent.click(screen.getByText("Next page →"));await act(async()=>{});
  const write=fetcher.mock.calls.find(c=>c[1]?.method==="PUT");expect(JSON.parse(write![1].body).draft[questions[0].id].strokes).toHaveLength(60);
 });
 it("blocks a blank second page and lists global question numbers in a dismissible popup",async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:0,draft:{},feedback:null}})});vi.stubGlobal("fetch",fetcher);
  render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false,initialPage:1}));
  fireEvent.click(await screen.findByText("Submit whole page"));
  expect(await screen.findByRole("dialog")).toBeTruthy();expect(screen.getByText("Unanswered questions: 11, 12")).toBeTruthy();
  expect(fetcher.mock.calls.some(call=>call[1]?.method==="POST")).toBe(false);
  fireEvent.click(screen.getByText("Keep working"));await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 });
 it("shows ten questions per page and does not grade while drawing",async()=>{
  const fetcher=vi.fn().mockImplementation(async(_url,options)=>({ok:true,json:async()=>options?.method==="PUT"?{data:{revision:1}}:{data:{revision:0,draft:{},feedback:null}}}));
  vi.stubGlobal("fetch",fetcher);
  render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false}));
  fireEvent.click(await screen.findByText("Draw on 10-question paper"));
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(0);
  fireEvent.click(screen.getByText("Next page →"));
  await screen.findByText("Draw on 2-question paper");
  expect(fetcher.mock.calls.some(call=>call[1]?.method==="PUT")).toBe(true);
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(0);
 });
 it("submits the entire page once and displays one combined score",async()=>{
  const draft=Object.fromEntries(questions.slice(0,10).map(q=>[q.id,{text:"1",strokes:[]}]));
  const results=questions.slice(0,10).map((q,index)=>({questionId:q.id,status:index?"incorrect":"correct",points:index?0:10}));
  const fetcher=vi.fn().mockImplementation(async(_url,options)=>({ok:true,json:async()=>options?.method==="POST"?{data:{revision:1,draft,feedback:{status:"graded",results,earned:10,maximum:100,pending:0}}}:{data:{revision:0,draft,feedback:null}}}));
  vi.stubGlobal("fetch",fetcher);
  render(createElement(PaperPlayer,{assignmentId:"assignment",studentId:"learner",title:"Math paper",questions,aiReady:false}));
  await screen.findByText("Draw on 10-question paper");
  fireEvent.click(screen.getByText("Submit whole page"));
  await screen.findByText("10 / 100");
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(1);
  expect(screen.getByText("Redo 9 wrong answers")).toBeTruthy();
  fireEvent.click(screen.getByText("Redo 9 wrong answers"));
  await waitFor(()=>expect(screen.getByText("Submit corrections")).toBeTruthy());
  fireEvent.click(screen.getByText("Submit corrections"));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(screen.getByText("Unanswered questions: 2, 3, 4, 5, 6, 7, 8, 9, 10")).toBeTruthy();
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==="POST")).toHaveLength(1);
 });
});
