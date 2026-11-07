import {ResourceError} from './resource-store';
export type BookSpeechOptions={voice:'af_heart';speed:.65|.85|1};
const MAX_AUDIO_BYTES=16*1024*1024;
/** Raw text only travels to the private Compose service, never through public URLs/logs. */
export async function bookSpeech(text:string,options:BookSpeechOptions){
 const url=process.env.TTS_SERVICE_URL||'http://tts:8080',timeout=Math.min(120000,Math.max(1000,Number(process.env.TTS_TIMEOUT_MS)||95000));
 const signal=AbortSignal.timeout(timeout);const started=Date.now();
 try{
  const health=await fetch(`${url}/health`,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(3000)])});
  if(!health.ok||(await health.json()).status!=='ready')throw new ResourceError('TTS_UNAVAILABLE','Reading audio is starting. Try again shortly.',503);
  const response=await fetch(`${url}/synthesize`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,...options}),signal,cache:'no-store'});
  if(!response.ok){const status=response.status;throw new ResourceError(status===504?'TTS_TIMEOUT':status===503?'TTS_BUSY':'TTS_UNAVAILABLE',status===504?'Reading audio timed out. Try again.':status===503?'Reading audio is busy. Try again shortly.':'Reading audio could not be prepared. Try again.',status===504?504:503);}
  if(!response.headers.get('content-type')?.startsWith('audio/wav')||Number(response.headers.get('content-length'))>MAX_AUDIO_BYTES)throw Error('INVALID_AUDIO');
  const reader=response.body?.getReader();if(!reader)throw Error('EMPTY_AUDIO');const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_AUDIO_BYTES)throw Error('AUDIO_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const audio=Buffer.concat(chunks,size);if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw Error('INVALID_AUDIO');
  const cache=response.headers.get('x-tts-cache')==='HIT'?'HIT':'MISS';
  console.info(JSON.stringify({event:'book_tts',status:'ready',cache,voice:options.voice,speed:options.speed,bytes:audio.length,ms:Date.now()-started}));
  return {audio,cache};
 }catch(e){const timedOut=signal.aborted||(e instanceof Error&&e.name==='TimeoutError');console.warn(JSON.stringify({event:'book_tts',status:timedOut?'timeout':'unavailable',ms:Date.now()-started}));if(e instanceof ResourceError)throw e;throw new ResourceError(timedOut?'TTS_TIMEOUT':'TTS_UNAVAILABLE',timedOut?'Reading audio timed out. Try again.':'Reading audio is unavailable. Ask your parent to check the app services.',timedOut?504:503);}
}
