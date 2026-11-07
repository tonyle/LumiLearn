// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import type {ActivityPart} from '@/lib/book-activity-contract';
import {BookActivityAreaEditor} from '@/components/book-activity-area-editor';
const part={id:'area',pageId:'page',label:'Drawing',kind:'draw',x:.1,y:.2,width:.7,height:.5,lines:6,rubric:'Draw.'} as ActivityPart;
afterEach(cleanup);
it('exposes touch-size resize handles and supports precise keyboard movement',()=>{
 const change=vi.fn();render(createElement(BookActivityAreaEditor,{imageUrl:'/page',pageNumber:1,parts:[part],disabled:false,onCreate:vi.fn(),onChange:change}));
 expect(screen.getAllByRole('button',{name:/Resize Drawing/})).toHaveLength(8);fireEvent.keyDown(screen.getByRole('button',{name:'Move Drawing'}),{key:'ArrowRight'});expect(change.mock.calls[0][1].x).toBeCloseTo(.105);
 fireEvent.keyDown(screen.getByRole('button',{name:'Resize Drawing bottom right'}),{key:'ArrowDown',shiftKey:true});expect(change.mock.calls[1][1].height).toBeCloseTo(.52);
});
it('does not change areas while disabled',()=>{const change=vi.fn();render(createElement(BookActivityAreaEditor,{imageUrl:'/page',pageNumber:1,parts:[part],disabled:true,onCreate:vi.fn(),onChange:change}));fireEvent.keyDown(screen.getByRole('button',{name:'Move Drawing'}),{key:'ArrowRight'});expect(change).not.toHaveBeenCalled();});
it('separates creation from selecting existing areas',()=>{render(createElement(BookActivityAreaEditor,{imageUrl:'/page',pageNumber:1,parts:[part],disabled:false,onCreate:vi.fn(),onChange:vi.fn()}));fireEvent.click(screen.getByRole('button',{name:'Draw a new area'}));expect(screen.queryByRole('button',{name:'Resize Drawing top left'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Select & adjust areas'}));expect(screen.getByRole('button',{name:'Resize Drawing top left'})).toBeTruthy();});
