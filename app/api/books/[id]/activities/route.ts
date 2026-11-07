import {activityError} from '@/lib/book-activities';
import {activityList} from '@/lib/book-activities';import {resourceSession} from '@/lib/resource-store';import {ok} from '@/lib/http';
export async function GET(_r:Request,{params}:{params:Promise<{id:string}>}){try{return ok({activities:await activityList((await params).id,await resourceSession())});}catch(e){return activityError(e);}}
