import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(),translate:vi.fn()}));
vi.mock('@/lib/db',()=>({sql:Object.assign((...args:unknown[])=>m.query(...args),{begin:(fn:(tx:typeof m.query)=>unknown)=>fn(m.query)})}));
vi.mock('@/lib/ai/book-translator',()=>({translationModel:()=> 'model',translationKey:()=> 'key',translateBookPassage:m.translate}));
vi.mock('@/lib/resource-store',()=>({ResourceError:class extends Error{constructor(public code:string,message:string,public status:number){super(message);}}}));
import {bookTranslation} from '@/lib/book-translations';
beforeEach(()=>{vi.clearAllMocks();});
it('returns persisted translations without calling OpenAI or reserving more budget',async()=>{
 m.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{translation:'Bản dịch đã lưu'}]);
 expect(await bookTranslation('Hello')).toEqual({translation:'Bản dịch đã lưu'});
 expect(m.translate).not.toHaveBeenCalled();expect(m.query).toHaveBeenCalledTimes(2);
});
it('prevents duplicate paid calls while the same passage is being translated',async()=>{
 m.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{claim_id:'busy',updated_at:new Date()}]);
 await expect(bookTranslation('Hello')).rejects.toThrow('being translated');expect(m.translate).not.toHaveBeenCalled();
});
