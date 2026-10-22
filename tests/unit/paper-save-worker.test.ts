import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';
const source=readFileSync('public/paper-save-worker.js','utf8');
describe('actual background save worker',()=>{
 it('serializes and sends the ink snapshot with same-origin credentials and returns its revision',async()=>{
  const self:{onmessage?:(event:{data:unknown})=>Promise<void>;postMessage:ReturnType<typeof vi.fn>}={postMessage:vi.fn()};
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:8}})});runInNewContext(source,{self,fetch:fetcher,Error});
  const endpoint='/api/student/assignments/00000000-0000-4000-8000-000000000001/pages/0',body={baseRevision:7,draft:{q:{text:'',strokes:[{tool:'pen',points:[{x:.2,y:.3,p:.5}]}]}}};
  await self.onmessage!({data:{id:12,endpoint,body}});expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][0]).toBe(endpoint);expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(body);expect(self.postMessage).toHaveBeenCalledWith({id:12,revision:8});
 });
 it('returns a failed save instead of reporting success for a server conflict',async()=>{
  const self:{onmessage?:(event:{data:unknown})=>Promise<void>;postMessage:ReturnType<typeof vi.fn>}={postMessage:vi.fn()};
  const fetcher=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:'Revision conflict'}})});runInNewContext(source,{self,fetch:fetcher,Error});
  await self.onmessage!({data:{id:3,endpoint:'/api/student/assignments/00000000-0000-4000-8000-000000000001/pages/0',body:{}}});expect(self.postMessage).toHaveBeenCalledWith({id:3,error:'Revision conflict'});
 });
});
