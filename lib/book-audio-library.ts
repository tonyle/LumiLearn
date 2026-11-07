import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,writeFile,rename,unlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
export const BOOK_AUDIO_SPEEDS=[.65,.85,1] as const;
export type BookAudioSpeed=typeof BOOK_AUDIO_SPEEDS[number];
export type AudioPages={id:string;revision:number;regions:{id:string;text:string}[]}[];
export type BookAudioProgress={state:'waiting'|'queued'|'processing'|'ready'|'error';total:number;ready:number;passages:number;fingerprint:string;updatedAt?:string;error?:string;retryAt?:number;workerReady?:boolean};
const VERSION='kokoro-82m-v1.0-7d5df8ec-voices-bca610b8-onnx0.6.1-af_heart-en-us-pcm16-24000-v1';
const MAX_BYTES=16*1024*1024;
export const bookAudioRoot=()=>process.env.BOOK_AUDIO_DIR||join(process.cwd(),'data','uploads','books','audio');
function directory(bookId:string){if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(bookId))throw Error('Invalid book ID');return join(bookAudioRoot(),bookId);}
const normalized=(text:string)=>text.normalize('NFC').trim().replace(/\s+/g,' ');
export function bookAudioKey(text:string){return createHash('sha256').update(JSON.stringify([VERSION,normalized(text),1])).digest('hex');}
export function audioJobs(pages:AudioPages){const jobs=new Map<string,{key:string;text:string;speed:BookAudioSpeed}>();for(const page of pages)for(const region of page.regions){const text=normalized(region.text);if(!text||text.length>1000||!/[\p{L}\p{N}]/u.test(text))continue;const speed=1 as const,key=bookAudioKey(text);jobs.set(key,{key,text,speed});}return [...jobs.values()];}
function wavHeader(audio:Buffer){return audio.length>=44&&audio.toString('ascii',0,4)==='RIFF'&&audio.toString('ascii',8,12)==='WAVE'&&audio.readUInt16LE(22)===1&&audio.readUInt32LE(24)===24000&&audio.readUInt16LE(34)===16;}
async function validFile(path:string){let file;try{file=await open(path,'r');const info=await file.stat();if(info.size<44||info.size>MAX_BYTES)return false;const header=Buffer.alloc(44);await file.read(header,0,44,0);return wavHeader(header);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}finally{await file?.close();}}
async function atomic(path:string,body:Buffer|string){const temporary=path+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,body,{mode:0o600,flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>{});}}
export async function readBookAudio(bookId:string,text:string){const path=join(directory(bookId),bookAudioKey(text)+'.wav');if(!await validFile(path))return null;const audio=await readFile(path);return audio.length<=MAX_BYTES&&wavHeader(audio)?audio:null;}
export async function writeBookAudio(bookId:string,text:string,audio:Buffer){if(audio.length>MAX_BYTES||!wavHeader(audio))throw Error('Invalid prepared audio');const dir=directory(bookId);await mkdir(dir,{recursive:true,mode:0o700});await atomic(join(dir,bookAudioKey(text)+'.wav'),audio);}
async function manifest(bookId:string):Promise<Partial<BookAudioProgress>>{try{return JSON.parse(await readFile(join(directory(bookId),'progress.json'),'utf8'));}catch(e){if(e instanceof SyntaxError||(e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}}
export async function bookAudioStatus(bookId:string,pages:AudioPages):Promise<BookAudioProgress>{
 const jobs=audioJobs(pages),fingerprint=createHash('sha256').update(jobs.map(j=>j.key).sort().join(':')).digest('hex');let ready=0;
 // Bound open file handles for large books; do not load entire WAVs to count readiness.
 for(let i=0;i<jobs.length;i+=16){const flags=await Promise.all(jobs.slice(i,i+16).map(j=>validFile(join(directory(bookId),j.key+'.wav'))));ready+=flags.filter(Boolean).length;}
 const previous=await manifest(bookId),same=previous.fingerprint===fingerprint;let workerReady=false;try{workerReady=Date.now()-(await stat(join(bookAudioRoot(),'.worker.json'))).mtimeMs<180000;}catch{/* Worker has not started yet. */}
 return {state:!jobs.length?'waiting':ready===jobs.length?'ready':same&&previous.state==='error'?'error':same&&previous.state==='processing'?'processing':'queued',total:jobs.length,ready,passages:pages.reduce((n,p)=>n+p.regions.filter(r=>normalized(r.text)).length,0),fingerprint,workerReady,...(same?{updatedAt:previous.updatedAt,error:previous.error,retryAt:previous.retryAt}:{})};
}
export async function requestBookAudio(bookId:string){const dir=directory(bookId);await mkdir(dir,{recursive:true,mode:0o700});await atomic(join(dir,'request.json'),JSON.stringify({at:Date.now()}));}
export async function audioPriority(bookId:string){try{return Number(JSON.parse(await readFile(join(directory(bookId),'request.json'),'utf8')).at)||0;}catch{return 0;}}
export async function audioHeartbeat(){await mkdir(bookAudioRoot(),{recursive:true,mode:0o700});await atomic(join(bookAudioRoot(),'.worker.json'),JSON.stringify({at:new Date().toISOString()}));}
export async function prepareBookAudio(bookId:string,pages:AudioPages,generate:(text:string,speed:BookAudioSpeed)=>Promise<Buffer>,limit=6,current:()=>Promise<boolean>=async()=>true){
 let progress=await bookAudioStatus(bookId,pages);if(progress.state==='ready'||progress.state==='waiting')return progress;
 const dir=directory(bookId);await mkdir(dir,{recursive:true,mode:0o700});
 const save=async()=>atomic(join(dir,'progress.json'),JSON.stringify(progress));
 progress={...progress,state:'processing',error:undefined,retryAt:undefined,updatedAt:new Date().toISOString()};await save();let created=0;
 try{for(const job of audioJobs(pages)){if(await validFile(join(dir,job.key+'.wav')))continue;if(created>=limit||!await current())break;const audio=await generate(job.text,job.speed);await writeBookAudio(bookId,job.text,audio);created++;progress.ready++;progress.updatedAt=new Date().toISOString();await save();}
  progress.state=progress.ready===progress.total?'ready':'processing';await save();
 }catch{progress={...progress,state:'error',error:'Audio preparation paused. The background worker will retry automatically.',retryAt:Date.now()+30000,updatedAt:new Date().toISOString()};await save();}
 return progress;
}
