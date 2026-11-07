import {activityError} from '@/lib/book-activities';
import {activityList,writeActivity} from '@/lib/book-activities';
import {resourceSession,parentResourceMutation,ResourceError} from '@/lib/resource-store';import {bodyJson,ok} from '@/lib/http';
export async function GET(_r:Request,{params}:{params:Promise<{id:string}>}){try{const s=await resourceSession();if(s.role!=='parent')throw new ResourceError('FORBIDDEN','Parent access required.',403);return ok({activities:await activityList((await params).id,s)});}catch(e){return activityError(e);}}
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){try{const s=await parentResourceMutation(r);return ok({activity:await writeActivity((await params).id,s,await bodyJson(r,100000))});}catch(e){return activityError(e);}}
