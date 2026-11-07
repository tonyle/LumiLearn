import {z} from 'zod';
import {resourceSession,resourceError,ResourceError} from '@/lib/resource-store';
import {readingTarget} from '@/lib/book-language';
import {readBookAudio} from '@/lib/book-audio-library';
export const runtime='nodejs';
const inputSchema=z.object({pageId:z.string().uuid(),regionId:z.string().min(1).max(80),voice:z.literal('af_heart').default('af_heart'),speed:z.enum(['0.65','0.85','1']).default('0.65')}).strict();
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const session=await resourceSession(request),input=inputSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const bookId=(await params).id,text=await readingTarget(bookId,{pageId:input.pageId,regionId:input.regionId},session);
  const audio=await readBookAudio(bookId,text);if(!audio)throw new ResourceError('AUDIO_PREPARING','This book audio is being prepared. Check Book studio for progress and try again shortly.',409);
  const cache='HIT';
  const headers:Record<string,string>={'content-type':'audio/wav','cache-control':'private, no-store','accept-ranges':'bytes','x-content-type-options':'nosniff','x-tts-cache':cache,'x-book-audio':'prepared'};
  const range=request.headers.get('range');let start=0,end=audio.length-1;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${audio.length}`}});
   if(!match[1])start=Math.max(0,audio.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=audio.length||(!match[1]&&Number(match[2])===0))return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${audio.length}`}});
   headers['content-range']=`bytes ${start}-${end}/${audio.length}`;
  }
  const body=new Uint8Array(audio.subarray(start,end+1));headers['content-length']=String(body.byteLength);
  return new Response(body,{status:range?206:200,headers});
 }catch(e){return resourceError(e);}
}
