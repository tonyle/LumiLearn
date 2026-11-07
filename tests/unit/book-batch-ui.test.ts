// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BookBatchExtract} from '@/components/book-batch-extract';
import type {BookPage} from '@/lib/book-contract';
const m=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@/components/book-api',()=>({bookRequest:m.request,bookJson:(v:unknown)=>({body:JSON.stringify(v)})}));
const pages=[{id:'one',page_number:1,reviewed:true},{id:'two',page_number:2,reviewed:false},{id:'three',page_number:3,reviewed:false}] as BookPage[];
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
it('one click processes remaining pages sequentially and automatically reviews them',async()=>{
 const complete=vi.fn().mockResolvedValue(undefined),busy=vi.fn();m.request.mockResolvedValue({page:{reviewed:true}});
 render(createElement(BookBatchExtract,{bookId:'book',pages,disabled:false,onBusy:busy,onComplete:complete}));
 fireEvent.click(screen.getByRole('button',{name:'Extract 2 pages & mark reviewed'}));
 await waitFor(()=>expect(complete).toHaveBeenCalled());
 expect(m.request.mock.calls.map(c=>c[0])).toEqual(['/api/parent/books/book/pages/two/extract','/api/parent/books/book/pages/three/extract']);
 expect(JSON.parse(m.request.mock.calls[0][1].body).autoReview).toBe(true);expect(screen.getByRole('status').textContent).toContain('2 pages extracted');expect(busy.mock.calls.at(-1)).toEqual([false]);
});
it('reports individual failures and keeps successful pages',async()=>{
 m.request.mockRejectedValueOnce(Error('Budget reached')).mockResolvedValueOnce({page:{reviewed:true}});
 render(createElement(BookBatchExtract,{bookId:'book',pages,disabled:false,onBusy:vi.fn(),onComplete:vi.fn().mockResolvedValue(undefined)}));
 fireEvent.click(screen.getByRole('button',{name:'Extract 2 pages & mark reviewed'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('1 page extracted'));
 expect(screen.getByText('Page 2: Budget reached')).toBeTruthy();
});
it('requires explicit include-reviewed choice before replacing already reviewed text',()=>{
 render(createElement(BookBatchExtract,{bookId:'book',pages,disabled:false,onBusy:vi.fn(),onComplete:vi.fn().mockResolvedValue(undefined)}));
 fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByRole('button',{name:'Extract 3 pages & mark reviewed'})).toBeTruthy();
});

it('stops starting paid requests after leaving the book studio',async()=>{
 let finish:(value:unknown)=>void=()=>{};m.request.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const complete=vi.fn().mockResolvedValue(undefined);
 const view=render(createElement(BookBatchExtract,{bookId:'book',pages,disabled:false,onBusy:vi.fn(),onComplete:complete}));
 fireEvent.click(screen.getByRole('button',{name:'Extract 2 pages & mark reviewed'}));view.unmount();finish({page:{reviewed:true}});
 await waitFor(()=>expect(complete).toHaveBeenCalled());expect(m.request).toHaveBeenCalledTimes(1);
});
