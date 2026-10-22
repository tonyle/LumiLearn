import type {PaperDraft} from './paper';
type Body={baseRevision:number;draft:PaperDraft};
type Result={revision:number};
/** Serialize and send large ink snapshots away from the input/UI thread when supported. */
export function createPaperSaver(){
 let worker:Worker|null=null,unavailable=false,sequence=0;
 const pending=new Map<number,{resolve:(value:Result)=>void;reject:(error:Error)=>void}>();
 function failed(){unavailable=true;worker?.terminate();worker=null;for(const request of pending.values())request.reject(Error('Background saving interrupted. Your writing is still here; try saving again.'));pending.clear();}
 async function fallback(endpoint:string,body:Body){const response=await fetch(endpoint,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json();if(!response.ok)throw Error(json.error?.message||'Could not save this page.');return json.data as Result;}
 return {
  save(endpoint:string,body:Body):Promise<Result>{
   if(unavailable||typeof Worker==='undefined')return fallback(endpoint,body);
   if(!worker){try{worker=new Worker('/paper-save-worker.js');worker.onerror=failed;worker.onmessage=event=>{const message=event.data,request=pending.get(message.id);if(!request)return;pending.delete(message.id);if(message.error)request.reject(Error(message.error));else if(Number.isInteger(message.revision))request.resolve({revision:message.revision});else request.reject(Error('Invalid save response. Please try again.'));};}catch{unavailable=true;return fallback(endpoint,body);}}
   const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});try{worker!.postMessage({id,endpoint,body});}catch{pending.delete(id);unavailable=true;worker?.terminate();worker=null;void fallback(endpoint,body).then(resolve,reject);}});
  },
  destroy(){worker?.terminate();worker=null;for(const request of pending.values())request.reject(Error('Worksheet closed.'));pending.clear();}
 };
}
