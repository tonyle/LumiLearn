/* Large JSON serialization and the save request run outside the handwriting thread. */
self.onmessage=async event=>{
 const {id,endpoint,body}=event.data;
 try{
  if(!/^\/api\/student\/assignments\/[a-f0-9-]{36}\/pages\/\d+$/.test(endpoint))throw Error('Invalid worksheet save path.');
  const response=await fetch(endpoint,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const json=await response.json();if(!response.ok)throw Error(json.error?.message||'Could not save this page.');
  self.postMessage({id,revision:json.data.revision});
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Could not save this page.'});}
};
