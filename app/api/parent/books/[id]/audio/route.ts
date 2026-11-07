import {bookDetail} from '@/lib/books';
import {bookAudioStatus,requestBookAudio} from '@/lib/book-audio-library';
import {parentResourceMutation,resourceSession,ResourceError,resourceError} from '@/lib/resource-store';
import {ok} from '@/lib/http';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const session=await resourceSession();if(session.role!=='parent')throw new ResourceError('FORBIDDEN','Parent access required.',403);const id=(await params).id,detail=await bookDetail(id,session);return ok(await bookAudioStatus(id,detail.pages));}catch(e){return resourceError(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const session=await parentResourceMutation(request),id=(await params).id,detail=await bookDetail(id,session);await requestBookAudio(id);return ok(await bookAudioStatus(id,detail.pages));}catch(e){return resourceError(e);}}
