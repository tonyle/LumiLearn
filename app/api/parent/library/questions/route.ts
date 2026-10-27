import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {ok,fail} from '@/lib/http';
import {parentLibraryQuestions} from '@/lib/parent-library';
import {GRADES,SUBJECTS} from '@/lib/worksheet-authoring';
export async function GET(request:Request){
 const session=await getSession();
 if(session?.role!=='parent')return fail('FORBIDDEN','Parent access required.',403);
 const params=z.object({grade:z.string().refine(value=>GRADES.includes(value as typeof GRADES[number])),subject:z.string().refine(value=>Object.hasOwn(SUBJECTS,value)),set:z.string().uuid().optional(),search:z.string().trim().max(200).optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!params.success)return fail('INVALID_FILTERS','Invalid library filters.',400);
 try{return ok(await parentLibraryQuestions(params.data));}catch{return fail('LIBRARY_UNAVAILABLE','Could not load questions. Please try again.',503);}
}
