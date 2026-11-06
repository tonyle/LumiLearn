// @vitest-environment jsdom
import {createElement} from 'react';import {render,screen,cleanup} from '@testing-library/react';import {afterEach,it,expect} from 'vitest';import {CatalogFilters,CatalogPagination} from '@/components/catalog-list';import {catalogFilters} from '@/lib/catalog';
afterEach(cleanup);
it('offers grade, subject, date and status filters without carrying an old page into a new search',()=>{render(createElement(CatalogFilters,{path:'/parent/worksheets',filters:catalogFilters({page:'4'}).filters,states:{'':'All worksheets',draft:'Draft'}}));expect(screen.getByLabelText('Search')).toBeTruthy();expect(screen.getByLabelText('Grade')).toBeTruthy();expect(screen.getByLabelText('Subject')).toBeTruthy();expect(screen.getByText('More filters').closest('details')?.open).toBe(false);expect(screen.getByRole('button',{name:'Apply filters'}).closest('form')?.querySelector('[name="page"]')).toBeNull();});
it('preserves collection search and dates when navigating to older results',()=>{render(createElement(CatalogPagination,{path:'/parent/generate#recent-collections',filters:catalogFilters({q:'decimal',from:'2026-10-01',grade:'5'}).filters,list:{page:1,pages:3,total:32}}));const href=screen.getByRole('link',{name:'Next'}).getAttribute('href')!;expect(href).toContain('q=decimal');expect(href).toContain('from=2026-10-01');expect(href).toContain('page=2#recent-collections');expect(screen.getByText('1–15 of 32 · Page 1 of 3')).toBeTruthy();});

import {fireEvent} from '@testing-library/react';
import {QuestionOrderButtons} from '@/components/worksheet-question-editor';
import {WorksheetPreview} from '@/components/worksheet-preview';
import {authorToQuestionSet,emptyAuthorDraft,emptyAuthorQuestion} from '@/lib/worksheet-authoring';
import type {QuestionSet} from '@/lib/question-contract';
it('uses the actual last question when enabling reorder controls',()=>{
 const view=render(createElement(QuestionOrderButtons,{index:10,total:12,disabled:false,onMove:()=>{}}));
 expect((screen.getByRole('button',{name:'Move down'}) as HTMLButtonElement).disabled).toBe(false);
 view.rerender(createElement(QuestionOrderButtons,{index:11,total:12,disabled:false,onMove:()=>{}}));
 expect((screen.getByRole('button',{name:'Move down'}) as HTMLButtonElement).disabled).toBe(true);
 view.rerender(createElement(QuestionOrderButtons,{index:0,total:1,disabled:false,onMove:()=>{}}));
 expect((screen.getByRole('button',{name:'Move up'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Move down'}) as HTMLButtonElement).disabled).toBe(true);
});
it('pages the paper and matching answer key without rendering every question',()=>{
 const draft=emptyAuthorDraft();draft.title='Flexible preview';draft.questions=Array.from({length:21},(_,i)=>({...emptyAuthorQuestion(i),text:`Prompt ${i+1}`,numberValue:String(i+1)}));
 render(createElement(WorksheetPreview,{set:authorToQuestionSet(draft) as QuestionSet}));
 expect(screen.getByText('Page 1 of 3')).toBeTruthy();expect(screen.getByText('Prompt 10')).toBeTruthy();expect(screen.queryByText('Prompt 11')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));
 expect(screen.getByText('Page 2 of 3')).toBeTruthy();expect(screen.getByText('Prompt 11')).toBeTruthy();expect(screen.queryByText('Prompt 1')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));
 expect(screen.getByText('Page 3 of 3')).toBeTruthy();expect(screen.getByText('Prompt 21')).toBeTruthy();expect(screen.getByAltText('Blank worksheet preview, page 3, questions 21–21')).toBeTruthy();
 expect((screen.getByRole('button',{name:'Next page'}) as HTMLButtonElement).disabled).toBe(true);
});
