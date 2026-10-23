import {gameSession,gameWallet,exchangeTime,exchangeSchema} from '@/lib/games';import {ok,bodyJson} from '@/lib/http';import {resourceError} from '@/lib/resource-store';
export async function POST(r:Request){try{const s=await gameSession(r);await exchangeTime(s.studentId!,exchangeSchema.parse(await bodyJson(r,2000)));return ok(await gameWallet(s.studentId!));}catch(e){return resourceError(e);}}
