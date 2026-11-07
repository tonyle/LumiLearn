import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(),page:vi.fn(),extract:vi.fn()}));
vi.mock('@/lib/db',()=>({sql:Object.assign((...args:unknown[])=>m.query(...args),{begin:(fn:(tx:unknown)=>unknown)=>fn(Object.assign(m.query,{json:(v:unknown)=>v}))})}));
vi.mock('@/lib/resource-store',()=>({parentResourceMutation:async()=>({role:'parent',parentId:'parent'}),ResourceError:class extends Error{constructor(public code:string,message:string,public status:number){super(message);}},resourceError:(e:Error)=>Response.json({error:e.message},{status:409})}));
vi.mock('@/lib/books',()=>({getBookPage:m.page}));
vi.mock('@/lib/book-files',()=>({readBookImage:async()=>Buffer.from('test')}));
vi.mock('@/lib/ai/book-extractor',()=>({extractBookPage:m.extract}));
import {POST} from '@/app/api/parent/books/[id]/pages/[pageId]/extract/route';
const region={id:'text',text:'A bird.',x:0,y:0,width:.5,height:.1};
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('AI_ENABLED','true');vi.stubEnv('EXTERNAL_AI_OPT_IN','true');vi.stubEnv('OPENAI_API_KEY','fake');vi.stubEnv('AI_MONTHLY_BUDGET_USD','10');
 m.page.mockResolvedValue({revision:1,image_key:'test'});m.extract.mockResolvedValue([region]);
 m.query.mockImplementation(async(strings:TemplateStringsArray,...values:unknown[])=>{
  const q=strings.join('?');if(q.includes('app_settings'))return[{value:{externalAiOptIn:true}}];if(q.includes('float8 amount'))return[{amount:0}];if(q.includes('SELECT id FROM reading_books'))return[{id:'book'}];if(q.includes('UPDATE reading_book_pages'))return[{id:'page',regions:values[0],reviewed:values[1]}];return[];
 });
});
afterEach(()=>vi.unstubAllEnvs());
function request(autoReview?:boolean){return POST(new Request('http://localhost',{method:'POST',body:JSON.stringify({key:'00000000-0000-4000-8000-000000000001',...(autoReview===undefined?{}:{autoReview})})}),{params:Promise.resolve({id:'book',pageId:'page'})});}
it('automatically reviews successful nonempty OCR only when explicitly requested',async()=>{const response=await request(true);expect((await response.json()).data.page.reviewed).toBe(true);expect(m.extract).toHaveBeenCalledTimes(1);});
it('preserves individual-page extraction review behavior',async()=>{expect((await (await request()).json()).data.page.reviewed).toBe(false);});
it('preserves existing page text when bulk OCR finds no readable text',async()=>{m.extract.mockResolvedValueOnce([]);const response=await request(true);expect(response.status).toBe(409);expect((await response.json()).error).toContain('Existing text was kept');expect(m.query.mock.calls.some(call=>call[0].join('?').includes('UPDATE reading_book_pages'))).toBe(false);});
it('does not call OpenAI when monthly budget is exhausted',async()=>{vi.stubEnv('AI_MONTHLY_BUDGET_USD','0');expect((await request(true)).status).toBe(409);expect(m.extract).not.toHaveBeenCalled();});
