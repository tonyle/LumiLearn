import type {ActivityDraft} from './book-activity-contract';
export type ActivitySaveBody={baseRevision:number;activityRevision:number;draft:ActivityDraft};
export type ActivitySaveResult={revision:number;activityRevision:number;draftActivityRevision?:number};
export type ActivitySaveError=Error&{code?:string;status?:number};
const path=/^\/api\/books\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/activities\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
function saveError(message:string,code?:unknown,status?:unknown):ActivitySaveError{const error:ActivitySaveError=Error(message);if(typeof code==='string')error.code=code;if(Number.isInteger(status)&&Number(status)>=100&&Number(status)<=599)error.status=Number(status);return error;}
function metadata(value:unknown):ActivitySaveResult{
 if(!value||typeof value!=='object')throw saveError('Invalid activity save response.');
 const state=value as Record<string,unknown>,positive=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
 if(!positive(state.revision)||!positive(state.activityRevision)||state.draftActivityRevision!==undefined&&!positive(state.draftActivityRevision))throw saveError('Invalid activity save response.');
 return {revision:state.revision as number,activityRevision:state.activityRevision as number,...(state.draftActivityRevision!==undefined?{draftActivityRevision:state.draftActivityRevision as number}:{})};
}
/** A failed in-flight worker request is never retried automatically: it may have committed. */
export function createActivitySaver(){
 let worker:Worker|null=null,unavailable=false,destroyed=false,sequence=0;
 const pending=new Map<number,{resolve:(value:ActivitySaveResult)=>void;reject:(error:Error)=>void}>(),controllers=new Set<AbortController>();
 function failed(){unavailable=true;worker?.terminate();worker=null;for(const request of pending.values())request.reject(saveError('Background saving interrupted. Your writing is still here; try saving again.'));pending.clear();}
 async function fallback(endpoint:string,body:ActivitySaveBody){
  const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const json=await response.json();if(destroyed)throw saveError('Activity closed.');if(!response.ok)throw saveError(typeof json.error?.message==='string'?json.error.message:'Could not save this activity.',json.error?.code,response.status);return metadata(json.data?.state);}finally{clearTimeout(timer);controllers.delete(controller);}
 }
 return {
  save(endpoint:string,body:ActivitySaveBody):Promise<ActivitySaveResult>{
   if(destroyed)return Promise.reject(saveError('Activity closed.'));
   if(!path.test(endpoint))return Promise.reject(saveError('Invalid activity save path.'));
   const id=++sequence;
   return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    if(unavailable||typeof Worker==='undefined'){void fallback(endpoint,body).then(value=>{pending.get(id)?.resolve(value);pending.delete(id);},error=>{pending.get(id)?.reject(error);pending.delete(id);});return;}
    if(!worker){try{worker=new Worker('/book-activity-save-worker.js');worker.onerror=failed;worker.onmessageerror=failed;worker.onmessage=event=>{const message=event.data,request=pending.get(message?.id);if(!request)return;pending.delete(message.id);if(typeof message.error==='string')request.reject(saveError(message.error,message.code,message.status));else try{request.resolve(metadata(message.state));}catch(error){request.reject(error as Error);}};}catch{unavailable=true;worker=null;void fallback(endpoint,body).then(value=>{pending.get(id)?.resolve(value);pending.delete(id);},error=>{pending.get(id)?.reject(error);pending.delete(id);});return;}}
    try{worker.postMessage({id,endpoint,body});}catch{failed();}
   });
  },
  destroy(){destroyed=true;worker?.terminate();worker=null;for(const controller of controllers)controller.abort();controllers.clear();for(const request of pending.values())request.reject(saveError('Activity closed.'));pending.clear();}
 };
}
