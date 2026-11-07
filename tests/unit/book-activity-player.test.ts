// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BookActivityPlayer} from '@/components/book-activity-player';
import type {BookDetail} from '@/lib/book-contract';
import type {ActivityAnswer} from '@/lib/book-activity-contract';
const m=vi.hoisted(()=>({request:vi.fn(),render:vi.fn()}));
vi.mock('@/components/book-api',()=>({bookRequest:m.request,bookJson:(v:unknown,method='POST')=>({method,body:JSON.stringify(v)})}));
vi.mock('@/lib/book-activity-save-client',()=>({createActivitySaver:()=>({save:(url:string,body:unknown)=>m.request(url,{method:'PUT',body:JSON.stringify(body)}).then((r:{state:unknown})=>r.state),destroy:vi.fn()})}));
vi.mock('@/lib/book-activity-drawing',()=>({renderActivityInkPng:m.render}));
vi.mock('@/components/book-activity-canvas',()=>({BookActivityCanvas:({answer,onChange,readOnly,part}:{answer:ActivityAnswer;onChange:(a:ActivityAnswer)=>void;readOnly:boolean;part:{id:string}})=>createElement('div',{'data-testid':`canvas-${part.id}`},createElement('textarea',{'aria-label':'Test answer',disabled:readOnly,value:answer.text,onChange:(e:{target:{value:string}})=>onChange({strokes:[],text:e.target.value})}))}));
const part={id:'part',pageId:'page',kind:'write',label:'Caption',lines:6,x:.1,y:.5,width:.8,height:.4};
const activity={id:'activity',book_id:'book',revision:1,title:'Tell about Sam',instructions:'Write a caption.',parts:[part],contextPageIds:['page'],published:true};
const state={revision:0,activityRevision:1,draft:{},attempts:[]};
const detail={book:{id:'book'},pages:[{id:'page',width:900,height:1200}]} as BookDetail;
beforeEach(()=>{vi.clearAllMocks();m.request.mockResolvedValue({activity,state});m.render.mockResolvedValue('data:image/png;base64,test');});afterEach(cleanup);
it('lists unfinished answer areas before allowing a submission',async()=>{render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:vi.fn()}));await screen.findByLabelText('Test answer');fireEvent.click(screen.getByRole('button',{name:'Submit activity'}));expect(screen.getByRole('dialog').textContent).toContain('Caption');expect(m.render).not.toHaveBeenCalled();expect(m.request).toHaveBeenCalledTimes(1);});
it('saves edits made during an in-flight save without blocking the answer input',async()=>{
 let finish:(v:unknown)=>void=()=>{};m.request.mockResolvedValueOnce({activity,state}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({state:{...state,revision:2}});
 const close=vi.fn();render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:close}));const input=await screen.findByLabelText('Test answer');
 fireEvent.change(input,{target:{value:'Sam can run.'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(2));
 expect((input as HTMLTextAreaElement).disabled).toBe(false);fireEvent.change(input,{target:{value:'Sam can jump.'}});fireEvent.click(screen.getByRole('button',{name:/Save & back/}));finish({state:{...state,revision:1}});
 await waitFor(()=>expect(close).toHaveBeenCalled());expect(m.request).toHaveBeenCalledTimes(3);expect(JSON.parse(m.request.mock.calls[2][1].body)).toMatchObject({baseRevision:1,draft:{part:{text:'Sam can jump.'}}});
});
it('flushes work before composing answer images and submitting once',async()=>{
 m.request.mockResolvedValueOnce({activity,state}).mockResolvedValueOnce({state:{...state,revision:1}}).mockResolvedValueOnce({state:{...state,revision:1,attempts:[{id:'attempt',created_at:'2026-11-06T12:00:00Z',results:[{partId:'part',points:10,maximum:10,feedback:'Well done!',needsReview:false}],earned:10,maximum:10}]}});
 render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:vi.fn()}));fireEvent.change(await screen.findByLabelText('Test answer'),{target:{value:'Sam can run.'}});fireEvent.click(screen.getByRole('button',{name:'Submit activity'}));
 expect(await screen.findByText('Well done!')).toBeTruthy();expect(m.request.mock.calls[1][1].method).toBe('PUT');expect(m.request.mock.calls[2][1].method).toBe('POST');expect(m.render).toHaveBeenCalledTimes(1);
});
it('resaves a compatible draft after the parent changes activity revision, even without a new edit',async()=>{
 m.request.mockResolvedValueOnce({activity,state:{...state,activityRevision:2,draftActivityRevision:1,draft:{part:{text:'Sam can run.',strokes:[]}}}}).mockResolvedValueOnce({state:{...state,activityRevision:2,draftActivityRevision:2,revision:1,draft:{part:{text:'Sam can run.',strokes:[]}}}});
 const close=vi.fn();render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:close}));await screen.findByLabelText('Test answer');fireEvent.click(screen.getByRole('button',{name:/Save & back/}));await waitFor(()=>expect(close).toHaveBeenCalled());expect(m.request.mock.calls[1][1].method).toBe('PUT');expect(JSON.parse(m.request.mock.calls[1][1].body).activityRevision).toBe(2);
});
it('adopts refreshed activity geometry with its saved revision after a grading error',async()=>{
 const nextActivity={...activity,revision:2,parts:[{...part,id:'newpart',x:.2,label:'New caption'}]};
 m.request.mockResolvedValueOnce({activity,state}).mockResolvedValueOnce({state:{...state,revision:1}}).mockRejectedValueOnce(Object.assign(Error('Checking failed'),{code:'GRADING_FAILED'})).mockResolvedValueOnce({activity:nextActivity,state:{...state,revision:2,activityRevision:2}}).mockResolvedValueOnce({state:{...state,revision:3,activityRevision:2}}).mockResolvedValueOnce({state:{...state,revision:3,activityRevision:2}});
 render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:vi.fn()}));fireEvent.change(await screen.findByLabelText('Test answer'),{target:{value:'Sam can run.'}});fireEvent.click(screen.getByRole('button',{name:'Submit activity'}));
 await screen.findByTestId('canvas-newpart');fireEvent.change(screen.getByLabelText('Test answer'),{target:{value:'Sam can jump.'}});fireEvent.click(screen.getByRole('button',{name:'Submit activity'}));
 await waitFor(()=>expect(m.render).toHaveBeenCalledTimes(2));expect(m.render.mock.calls[1][2]).toMatchObject({id:'newpart',x:.2});expect(JSON.parse(m.request.mock.calls[4][1].body)).toMatchObject({activityRevision:2,draft:{newpart:{text:'Sam can jump.'}}});
});

it('recovers a committed save after a lost acknowledgement and keeps newer edits',async()=>{
 let fail:(e:Error)=>void=()=>{};const first={part:{text:'Sam can run.',strokes:[]}};
 m.request.mockResolvedValueOnce({activity,state}).mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;})).mockResolvedValueOnce({state:{...state,revision:1,draft:first}}).mockResolvedValueOnce({state:{...state,revision:2}});
 const close=vi.fn();render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:close}));const input=await screen.findByLabelText('Test answer');fireEvent.change(input,{target:{value:'Sam can run.'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(2));fireEvent.change(input,{target:{value:'Sam can jump.'}});fail(Error('Connection lost'));await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(4));expect(JSON.parse(m.request.mock.calls[3][1].body)).toMatchObject({baseRevision:1,draft:{part:{text:'Sam can jump.'}}});
});
it('preserves local answers and stays open when another tab saved different work',async()=>{
 m.request.mockResolvedValueOnce({activity,state}).mockRejectedValueOnce(Error('Conflict')).mockResolvedValueOnce({state:{...state,revision:1,draft:{part:{text:'Other work',strokes:[]}}}});const close=vi.fn();render(createElement(BookActivityPlayer,{detail,activityId:'activity',onClose:close}));const input=await screen.findByLabelText('Test answer');fireEvent.change(input,{target:{value:'My answer'}});fireEvent.click(screen.getByRole('button',{name:/Save & back/}));await screen.findByRole('alert');expect(close).not.toHaveBeenCalled();expect((input as HTMLTextAreaElement).value).toBe('My answer');expect((input as HTMLTextAreaElement).disabled).toBe(false);
});
