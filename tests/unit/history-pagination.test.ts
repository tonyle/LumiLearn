import {describe,it,expect} from 'vitest';
import {parentHistoryPage,parentHistoryHref,PARENT_HISTORY_PAGE_SIZE} from '../../lib/history-pagination';
describe('parent history pagination',()=>{
 it('uses fifteen rows and normalizes malformed page requests',()=>{expect(PARENT_HISTORY_PAGE_SIZE).toBe(15);for(const value of [undefined,'0','-1','NaN','2.5','999999999'])expect(parentHistoryPage(value)).toBe(1);expect(parentHistoryPage('3')).toBe(3);});
 it('keeps learner and day while independently paging both lists',()=>{const url=new URL(parentHistoryHref('learner & one','2026-10-27',2,3),'http://localhost');expect(Object.fromEntries(url.searchParams)).toEqual({student:'learner & one',date:'2026-10-27',page:'2',earlierPage:'3'});expect(parentHistoryHref('learner','2026-10-27')).not.toContain('Page=');});
});
