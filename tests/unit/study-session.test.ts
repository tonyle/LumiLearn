// @vitest-environment jsdom
import {createElement} from 'react';import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';import {afterEach,it,expect,vi} from 'vitest';import {PaperPlayer} from '@/components/paper-player';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('next/link',()=>({default:'a'}));vi.mock('@/components/paper-ink',()=>({PaperInk:()=>createElement('div',null,'The worksheet questions')}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('hides all questions behind a modal pause screen, freezes time, resumes and records the submitted duration',async()=>{
 let state='running';const actions:string[]=[];
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url,options)=>{
  if(String(url).endsWith('/timer')){const action=JSON.parse(options.body).action;actions.push(action);state=action==='pause'?'paused':'running';return {ok:true,json:async()=>({data:{state,elapsedMs:4000,started:true,serverNow:Date.now(),leaseUntil:Date.now()+45000}})};}
  if(options?.method==='PUT')return {ok:true,json:async()=>({data:{revision:1}})};
  if(options?.method==='POST')return {ok:true,json:async()=>({data:{revision:2,draft:{one:{text:'2',strokes:[]}},feedback:{status:'graded',results:[{questionId:'one',status:'correct',points:10}],earned:10,maximum:10,pending:0},clock:{state:'submitted',elapsedMs:8000,started:true,serverNow:Date.now(),leaseUntil:null}}})};
  return {ok:true,json:async()=>({data:{revision:0,draft:{},feedback:null}})};
 }));
 render(createElement(PaperPlayer,{assignmentId:'lesson',studentId:'student',title:'Timed lesson',questions:[{id:'one',type:'number',prompt:{text:'1 + 1?'},options:[]}],aiReady:false}));
 await screen.findByRole('button',{name:'Pause'});fireEvent.click(screen.getByRole('button',{name:'Pause'}));
 const dialog=await screen.findByRole('dialog');await screen.findByText('Your lesson is paused');expect(screen.queryByRole('button',{name:'Pen'})).toBeNull();
 fireEvent.keyDown(dialog,{key:'Escape'});expect(screen.getByRole('dialog')).toBeTruthy();expect(actions).toContain('pause');
 fireEvent.click(screen.getByRole('button',{name:'Resume lesson'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(actions).toContain('resume');
 fireEvent.click(screen.getByText('Keyboard alternative & accessible question text'));fireEvent.change(screen.getByLabelText('Answer 1'),{target:{value:'2'}});fireEvent.click(screen.getByText('Submit whole page'));
 await screen.findByText('10 / 10');await screen.findByText('00:08');expect(screen.queryByRole('button',{name:'Pause'})).toBeNull();
});
