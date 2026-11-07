/* Keep large snapshot serialization and response parsing off the writing thread. */
const activitySavePath=/^\/api\/books\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/activities\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const positive=value=>Number.isSafeInteger(value)&&value>0;
self.onmessage=async event=>{
 const {id,endpoint,body}=event.data;
 try{
  if(typeof endpoint!=='string'||!activitySavePath.test(endpoint))throw Error('Invalid activity save path.');
  const response=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const json=await response.json();
  if(!response.ok){self.postMessage({id,error:typeof json.error?.message==='string'?json.error.message:'Could not save this activity.',...(typeof json.error?.code==='string'?{code:json.error.code}:{}),status:response.status});return;}
  const state=json.data?.state;
  if(!state||!positive(state.revision)||!positive(state.activityRevision)||state.draftActivityRevision!==undefined&&!positive(state.draftActivityRevision))throw Error('Invalid activity save response.');
  self.postMessage({id,state:{revision:state.revision,activityRevision:state.activityRevision,...(state.draftActivityRevision!==undefined?{draftActivityRevision:state.draftActivityRevision}:{})}});
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Could not save this activity.'});}
};
