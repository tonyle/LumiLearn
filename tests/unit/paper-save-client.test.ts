import {afterEach,describe,it,expect,vi} from 'vitest';
import {createPaperSaver} from '@/lib/paper-save-client';
import type {PaperDraft} from '@/lib/paper';
const body={baseRevision:4,draft:{q:{text:'',strokes:[{tool:'pen',points:[{x:.2,y:.3,p:.5}]}]}} as PaperDraft};
afterEach(()=>vi.unstubAllGlobals());
describe('background paper saver',()=>{
 it('passes the draft to a worker without serializing it or calling fetch on the input thread',async()=>{
  const instances:FakeWorker[]=[];
  class FakeWorker{onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;postMessage=vi.fn();terminate=vi.fn();constructor(public url:string){instances.push(this);}}
  vi.stubGlobal('Worker',FakeWorker);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const saver=createPaperSaver(),promise=saver.save('/api/student/assignments/id/pages/0',body),worker=instances[0];
  expect(worker.url).toBe('/paper-save-worker.js');expect(worker.postMessage).toHaveBeenCalledWith({id:1,endpoint:'/api/student/assignments/id/pages/0',body});expect(fetcher).not.toHaveBeenCalled();
  worker.onmessage!({data:{id:1,revision:5}});await expect(promise).resolves.toEqual({revision:5});saver.destroy();expect(worker.terminate).toHaveBeenCalledOnce();
 });
 it('keeps normal saving available if workers are unavailable',async()=>{
  vi.stubGlobal('Worker',undefined);const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{revision:5}})});vi.stubGlobal('fetch',fetcher);
  const saver=createPaperSaver();await expect(saver.save('/page',body)).resolves.toEqual({revision:5});expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(body);
 });
 it('surfaces worker save conflicts without pretending the draft was saved',async()=>{
  const workers:FakeWorker[]=[];
  class FakeWorker{onmessage:((event:{data:unknown})=>void)|null=null;postMessage=vi.fn();terminate=vi.fn();constructor(){workers.push(this);}}
  vi.stubGlobal('Worker',FakeWorker);const saver=createPaperSaver(),promise=saver.save('/page',body);workers[0].onmessage!({data:{id:1,error:'Revision conflict'}});await expect(promise).rejects.toThrow('Revision conflict');saver.destroy();
 });
});
