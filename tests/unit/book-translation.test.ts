import {afterEach,describe,it,expect,vi} from 'vitest';
import {translationKey,translateBookPassage} from '@/lib/ai/book-translator';
vi.mock('@/lib/resource-store',()=>({ResourceError:class extends Error{constructor(public code:string,message:string,public status:number){super(message);}}}));
afterEach(()=>vi.unstubAllEnvs());
describe('book passage translation',()=>{
 it('keys by content, model and normalized Unicode, never student identity',()=>{
  expect(translationKey(' Hello ','a')).toBe(translationKey('Hello','a'));
  expect(translationKey('Hello','a')).not.toBe(translationKey('Hello!','a'));
  expect(translationKey('Hello','a')).not.toBe(translationKey('Hello','b'));
 });
 it('sends only selected text with no reasoning or stored conversation',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({status:'completed',output:[{content:[{type:'output_text',text:' Con chim nhỏ đang bay. '}]}]}));
  expect(await translateBookPassage('The little bird is flying.','gpt-6-luna',fetcher)).toBe('Con chim nhỏ đang bay.');
  const payload=JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload).toMatchObject({input:'The little bird is flying.',store:false,reasoning:{effort:'none'},max_output_tokens:1400});
  expect(payload).not.toHaveProperty('previous_response_id');
 });
 it.each([{status:'incomplete',output:[{content:[{type:'output_text',text:'partial'}]}]},{status:'completed',output:[]}])('rejects truncated or empty translations',async result=>{
  await expect(translateBookPassage('Hello','gpt-6-luna',vi.fn().mockResolvedValue(Response.json(result)))).rejects.toThrow('incomplete');
 });
 it('does not expose provider errors or secrets',async()=>{
  await expect(translateBookPassage('Hello','gpt-6-luna',vi.fn().mockResolvedValue(new Response('secret',{status:429})))).rejects.toThrow('Please try again later');
 });
});
