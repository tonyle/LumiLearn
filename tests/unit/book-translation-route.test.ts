import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),target:vi.fn(),local:vi.fn(),ai:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/resource-store',()=>({resourceSession:mocks.session,resourceError:()=>Response.json({error:true},{status:403})}));
vi.mock('@/lib/book-language',()=>({readingTargetSchema:{parse:(v:unknown)=>v},readingTarget:mocks.target,readingService:mocks.local,limitReading:mocks.limit}));
vi.mock('@/lib/book-translations',()=>({bookTranslation:mocks.ai}));
import {POST} from '@/app/api/books/[id]/translate/route';
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({id:'student'});mocks.target.mockResolvedValue('Hello');mocks.ai.mockResolvedValue({translation:'Xin chào'});mocks.local.mockResolvedValue(Response.json({translation:'Chào'}));});
function request(wordIndex?:number){return POST(new Request('http://localhost/api/books/book/translate',{method:'POST',body:JSON.stringify({pageId:'page',regionId:'region',...(wordIndex===undefined?{}:{wordIndex})})}),{params:Promise.resolve({id:'book'})});}
it('uses OpenAI for the complete authorized passage',async()=>{expect((await request()).status).toBe(200);expect(mocks.ai).toHaveBeenCalledWith('Hello');expect(mocks.local).not.toHaveBeenCalled();});
it('keeps the first word and every word on the free local translator',async()=>{await request(0);expect(mocks.local).toHaveBeenCalled();expect(mocks.ai).not.toHaveBeenCalled();});
it('checks book access before looking up a cached paid translation',async()=>{mocks.target.mockRejectedValueOnce(Error('denied'));expect((await request()).status).toBe(403);expect(mocks.ai).not.toHaveBeenCalled();expect(mocks.local).not.toHaveBeenCalled();});
