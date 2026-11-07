// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BookCreate,BookParent} from '@/components/book-parent';
import type {BookDetail} from '@/lib/book-contract';
const m=vi.hoisted(()=>({request:vi.fn(),push:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:m.push,refresh:m.refresh})}));
vi.mock('@/components/book-api',()=>({bookRequest:m.request,bookJson:(v:unknown,method='POST')=>({method,body:JSON.stringify(v)})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('offers multiple files when creating a book',()=>{render(createElement(BookCreate));const input=screen.getByLabelText('Book pages · optional') as HTMLInputElement;expect(input.multiple).toBe(true);expect(input.accept).toContain('application/pdf');});
it('shows per-page status, selection and order controls in the existing studio',async()=>{
 const detail={book:{id:'book',title:'Story',description:'',grade:'1',revision:1,published:false},studentIds:[],pages:[{id:'p1',page_number:1,revision:1,regions:[],reviewed:false},{id:'p2',page_number:2,revision:2,regions:[],reviewed:false}]} as unknown as BookDetail;
 m.request.mockImplementation(async(url:string,init?:{method:string})=>url.endsWith('/activities')?{activities:[]}:init?.method==='PUT'?{page:{}}:{...detail,pages:[{...detail.pages[1],page_number:1},{...detail.pages[0],page_number:2}]});
 render(createElement(BookParent,{initial:detail,students:[]}));
 expect(screen.getByRole('list',{name:'Book pages'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Move page 1 later'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Page order updated'));
 const move=m.request.mock.calls.find(c=>c[0]==='/api/parent/books/book/pages/p1')!;expect(move[0]).toBe('/api/parent/books/book/pages/p1');expect(JSON.parse(move[1].body)).toMatchObject({pageNumber:2,baseRevision:1});
});
