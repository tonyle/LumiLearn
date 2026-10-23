import {readMeadowRace} from '@/lib/math-meadow-store';
import {sql} from '@/lib/db';
import {gameSession,finishFlight,finishSchema} from '@/lib/games';import {ok,bodyJson} from '@/lib/http';import {resourceError} from '@/lib/resource-store';
export async function POST(r:Request){try{const s=await gameSession(r);const b=finishSchema.parse(await bodyJson(r,30000));const [run]=await sql`SELECT game_code FROM game_runs WHERE id=${b.runId} AND student_id=${s.studentId!}`;const race=run&&['math20','mathfacts'].includes(run.game_code)?await readMeadowRace(s.studentId!,b.runId):{};return ok({...await finishFlight(s.studentId!,b),...race});}catch(e){return resourceError(e);}}
