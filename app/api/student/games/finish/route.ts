import {gameSession,finishFlight,finishSchema} from '@/lib/games';import {ok,bodyJson} from '@/lib/http';import {resourceError} from '@/lib/resource-store';
export async function POST(r:Request){try{const s=await gameSession(r);return ok(await finishFlight(s.studentId!,finishSchema.parse(await bodyJson(r,30000))));}catch(e){return resourceError(e);}}
