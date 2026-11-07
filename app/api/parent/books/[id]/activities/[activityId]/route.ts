import {activityError} from '@/lib/book-activities';
import {writeActivity,deleteActivity} from '@/lib/book-activities';import {parentResourceMutation} from '@/lib/resource-store';import {bodyJson,ok} from '@/lib/http';
export async function PATCH(r:Request,{params}:{params:Promise<{id:string;activityId:string}>}){try{const s=await parentResourceMutation(r),{id,activityId}=await params;return ok({activity:await writeActivity(id,s,await bodyJson(r,100000),activityId)});}catch(e){return activityError(e);}}
export async function DELETE(r:Request,{params}:{params:Promise<{id:string;activityId:string}>}){try{const s=await parentResourceMutation(r),{id,activityId}=await params;await deleteActivity(id,activityId,s);return ok({deleted:true});}catch(e){return activityError(e);}}
