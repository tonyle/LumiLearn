/** Compose-managed resumable pre-generation. Never runs in a student's Listen request. */
import postgres from 'postgres';
import {setTimeout as sleep} from 'node:timers/promises';
import {audioHeartbeat,audioPriority,bookAudioStatus,prepareBookAudio,type AudioPages} from '../lib/book-audio-library';
import {bookSpeech} from '../lib/book-tts';
const db=postgres(process.env.DATABASE_URL!,{max:1});let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
type Page=AudioPages[number]&{book_id:string;book_revision:number;book_updated_at:string};
try{while(!stopping){
 try{
  await audioHeartbeat();
  const rows=await db<Page[]>`SELECT p.id,p.book_id,p.regions,p.revision,b.revision book_revision,b.updated_at book_updated_at FROM reading_book_pages p JOIN reading_books b ON b.id=p.book_id WHERE b.deleted_at IS NULL AND jsonb_array_length(p.regions)>0 ORDER BY b.updated_at DESC,p.page_number,p.id`;
  const books=new Map<string,Page[]>();for(const p of rows){const pages=books.get(p.book_id)||[];pages.push(p);books.set(p.book_id,pages);}
  const ordered=await Promise.all([...books.entries()].map(async([id,pages])=>({id,pages,priority:Math.max(await audioPriority(id),new Date(pages[0].book_updated_at).getTime())})));ordered.sort((a,b)=>b.priority-a.priority);
  for(const {id,pages,priority} of ordered){
   if(stopping)break;await audioHeartbeat();const status=await bookAudioStatus(id,pages);
   if(status.state==='ready'||status.state==='waiting'||(status.retryAt||0)>Date.now()&&priority<Date.parse(status.updatedAt||''))continue;
   const progress=await prepareBookAudio(id,pages,async(text,speed)=>{await audioHeartbeat();const result=await bookSpeech(text,{voice:'af_heart',speed});await audioHeartbeat();return result.audio;},1,async()=>{if(stopping)return false;const [book]=await db`SELECT revision FROM reading_books WHERE id=${id} AND deleted_at IS NULL`;return book?.revision===pages[0].book_revision;});
   console.info(JSON.stringify({event:'book_audio_preparation',state:progress.state,ready:progress.ready,total:progress.total}));await audioHeartbeat();if(progress.state!=='error')break;
  }
 }catch{console.warn(JSON.stringify({event:'book_audio_worker',state:'retrying'}));}
 if(!stopping)await sleep(2000);
}}finally{await db.end({timeout:5});}
