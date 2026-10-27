import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getSession:vi.fn(),questions:vi.fn()}));
vi.mock('@/lib/auth',()=>({getSession:mocks.getSession}));
vi.mock('@/lib/parent-library',()=>({parentLibraryQuestions:mocks.questions}));
import {GET} from '../app/api/parent/library/questions/route';
beforeEach(()=>{vi.clearAllMocks();mocks.getSession.mockResolvedValue({role:'parent'});mocks.questions.mockResolvedValue({questions:[],total:0,page:1,pageSize:20});});
describe('parent library pagination endpoint',()=>{
 it.each([null,{role:'student'},{role:'admin'}])('does not expose answer keys to %s',async session=>{
  mocks.getSession.mockResolvedValue(session);
  expect((await GET(new Request('http://localhost/api/parent/library/questions?grade=3&subject=math'))).status).toBe(403);
  expect(mocks.questions).not.toHaveBeenCalled();
 });
 it.each(['page=0','page=1.5','page=100001','subject=__proto__','grade=invalid'])('rejects invalid filters %s',async filter=>{
  expect((await GET(new Request(`http://localhost/api/parent/library/questions?grade=3&subject=math&${filter}`))).status).toBe(400);
  expect(mocks.questions).not.toHaveBeenCalled();
 });
 it('passes paginated search and set filters to the bounded query',async()=>{
  const set='2e059c5b-2f6b-4a77-ab19-0c3398fda35a';
  const response=await GET(new Request(`http://localhost/api/parent/library/questions?grade=3&subject=math&page=2&search=%20sum%20&set=${set}`));
  expect(response.status).toBe(200);
  expect(mocks.questions).toHaveBeenCalledWith({grade:'3',subject:'math',page:2,search:'sum',set});
 });
 it('returns a retryable error when fetching fails',async()=>{
  mocks.questions.mockRejectedValue(new Error('database connection'));
  expect((await GET(new Request('http://localhost/api/parent/library/questions?grade=3&subject=math'))).status).toBe(503);
 });
});
