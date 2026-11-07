import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';
const source=readFileSync('public/book-activity-save-worker.js','utf8');
const endpoint='/api/books/00000000-0000-4000-8000-000000000001/activities/00000000-0000-4000-8000-000000000002';
function worker(json:unknown,ok=true,status=200){const self:{onmessage?:(event:{data:unknown})=>Promise<void>;postMessage:ReturnType<typeof vi.fn>}={postMessage:vi.fn()},fetcher=vi.fn().mockResolvedValue({ok,status,json:async()=>json});runInNewContext(source,{self,fetch:fetcher,Error,AbortSignal});return {self,fetcher};}
describe('book activity save worker',()=>{
 it('sends same-origin PUT and only returns validated metadata',async()=>{const {self,fetcher}=worker({data:{state:{revision:8,activityRevision:2,draftActivityRevision:2,draft:{large:'ignored'}}}}),body={baseRevision:7,activityRevision:2,draft:{}};await self.onmessage!({data:{id:1,endpoint,body}});expect(fetcher.mock.calls[0][1]).toMatchObject({method:'PUT',credentials:'same-origin',body:JSON.stringify(body)});expect(self.postMessage).toHaveBeenCalledWith({id:1,state:{revision:8,activityRevision:2,draftActivityRevision:2}});});
 it.each([0,-1,1.2,'8',null,Infinity])('rejects invalid revision %s',async revision=>{const {self}=worker({data:{state:{revision,activityRevision:2}}});await self.onmessage!({data:{id:2,endpoint,body:{}}});expect(self.postMessage.mock.calls[0][0].error).toMatch(/Invalid/);});
 it('preserves server error code and HTTP status',async()=>{const {self}=worker({error:{message:'Changed activity',code:'ACTIVITY_CHANGED'}},false,409);await self.onmessage!({data:{id:3,endpoint,body:{}}});expect(self.postMessage).toHaveBeenCalledWith({id:3,error:'Changed activity',code:'ACTIVITY_CHANGED',status:409});});
 it.each(['https://evil.test'+endpoint,endpoint+'?x=1',endpoint+'/attempts','/api/books/not-a-uuid/activities/not-a-uuid'])('does not fetch invalid path %s',async path=>{const {self,fetcher}=worker({});await self.onmessage!({data:{id:4,endpoint:path,body:{}}});expect(fetcher).not.toHaveBeenCalled();expect(self.postMessage.mock.calls[0][0].error).toMatch(/Invalid/);});
});

describe('activity saver lifecycle',()=>{
 it('rejects pending worker saves without retrying after unknown failure',async()=>{
  const {createActivitySaver}=await import('../../lib/book-activity-save-client');
  const instances:FakeWorker[]=[];
  class FakeWorker{onerror:(()=>void)|null=null;onmessage:((event:{data:unknown})=>void)|null=null;onmessageerror:(()=>void)|null=null;postMessage=vi.fn();terminate=vi.fn();constructor(){instances.push(this);}}
  vi.stubGlobal('Worker',FakeWorker);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  try{const saver=createActivitySaver(),saving=saver.save(endpoint,{baseRevision:1,activityRevision:1,draft:{}});const rejected=expect(saving).rejects.toThrow(/interrupted/);instances[0].onerror!();await rejected;expect(fetcher).not.toHaveBeenCalled();saver.destroy();}finally{vi.unstubAllGlobals();}
 });
 it('rejects all pending requests and new requests after destruction',async()=>{
  const {createActivitySaver}=await import('../../lib/book-activity-save-client');
  class FakeWorker{postMessage=vi.fn();terminate=vi.fn();}
  vi.stubGlobal('Worker',FakeWorker);
  try{const saver=createActivitySaver(),body={baseRevision:1,activityRevision:1,draft:{}},saving=saver.save(endpoint,body),rejected=expect(saving).rejects.toThrow(/closed/);saver.destroy();await rejected;await expect(saver.save(endpoint,body)).rejects.toThrow(/closed/);}finally{vi.unstubAllGlobals();}
 });
 it('validates metadata on the Worker-unavailable fallback and preserves errors',async()=>{
  const {createActivitySaver}=await import('../../lib/book-activity-save-client');vi.stubGlobal('Worker',undefined);
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,status:200,json:async()=>({data:{state:{revision:'2',activityRevision:1}}})}).mockResolvedValueOnce({ok:false,status:409,json:async()=>({error:{code:'REVISION_CONFLICT',message:'Changed'}})});vi.stubGlobal('fetch',fetcher);
  try{const saver=createActivitySaver(),body={baseRevision:1,activityRevision:1,draft:{}};await expect(saver.save(endpoint,body)).rejects.toThrow(/Invalid/);await expect(saver.save(endpoint,body)).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});expect(fetcher.mock.calls[0][1]).toMatchObject({credentials:'same-origin',method:'PUT'});expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);saver.destroy();}finally{vi.unstubAllGlobals();}
 });
});
