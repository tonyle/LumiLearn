import {z} from 'zod';import {sql} from './db';import {walletLock} from './games';import {ResourceError} from './resource-store';import {meadowProblem,meadowQuestion,type MathMode} from './math-meadow';
import {advanceRace,createMeadowRace,raceAnswer,raceSummary,type MeadowRace,type PokemonId} from './meadow-race';
export const meadowAnswerSchema=z.object({runId:z.string().uuid(),index:z.number().int().min(0).max(10000),answer:z.number().int().min(0).max(81),key:z.string().uuid()}).strict();
function view(state:MeadowRace,seed:number,mode:MathMode){return {race:state,summary:raceSummary(state),question:state.questionIndex<10&&!state.finished?meadowQuestion(seed,state.questionIndex,mode):null};}
export async function readMeadowRace(id:string,runId:string,pokemon:PokemonId=25){return sql.begin(async tx=>{await walletLock(tx,id);const [run]=await tx`SELECT *,least(extract(epoch FROM (now()-started_at)),reserved_seconds)::float8 elapsed FROM game_runs WHERE id=${runId} AND student_id=${id} FOR UPDATE`;if(!run||!['math20','mathfacts'].includes(run.game_code))throw new ResourceError('NOT_FOUND','Race not found.',404);
 const [record]=await tx`SELECT state FROM game_math_races WHERE run_id=${runId}`;
 const state=(record?.state??createMeadowRace(Number(run.seed),pokemon)) as MeadowRace;
 if(!run.ended_at)advanceRace(state,Number(run.elapsed));
 await tx`INSERT INTO game_math_races(run_id,state) VALUES(${runId},${tx.json(state)}) ON CONFLICT(run_id) DO UPDATE SET state=excluded.state,updated_at=now()`;
 return view(state,Number(run.seed),run.game_code as MathMode);
});}
export async function answerMeadow(id:string,b:z.infer<typeof meadowAnswerSchema>){return sql.begin(async tx=>{const w=await walletLock(tx,id);const [run]=await tx`SELECT *,expires_at>now() available,least(extract(epoch FROM (now()-started_at)),reserved_seconds)::float8 elapsed FROM game_runs WHERE id=${b.runId} AND student_id=${id} FOR UPDATE`;if(!run||!['math20','mathfacts'].includes(run.game_code))throw new ResourceError('NOT_FOUND','Race not found.',404);const [prior]=await tx`SELECT * FROM game_math_answers WHERE request_key=${b.key}`;if(prior){if(prior.run_id!==b.runId||Number(prior.question_index)!==b.index||Number(prior.answer)!==b.answer)throw new ResourceError('CONFLICT','This answer changed. Try again.',409);return prior.response;}if(!run.available||run.ended_at||!w.enabled)throw new ResourceError('TIME_UP','Play time has ended. Save your race and return to Games.',409);
 const [record]=await tx`SELECT state FROM game_math_races WHERE run_id=${run.id}`;const state=(record?.state??createMeadowRace(Number(run.seed))) as MeadowRace;advanceRace(state,Number(run.elapsed));
 if(state.finished||state.questionIndex>=10)throw new ResourceError('FINISHED','All questions are answered. Watch the finish!',409);
 if(b.index!==state.questionIndex)throw new ResourceError('STALE','This question was already answered. Refresh the race.',409);
 const responseSeconds=Math.max(0,state.elapsed-state.questionAt);if(responseSeconds<.4)throw new ResourceError('SLOW_DOWN','Take a moment, then try again.',429);
 const problem=meadowProblem(Number(run.seed),state.questionIndex,run.game_code as MathMode),correct=b.answer===problem.answer;raceAnswer(state,correct,responseSeconds);
 const response={correct,score:state.correct,responseSeconds,combo:correct&&state.streak%3===0,...view(state,Number(run.seed),run.game_code as MathMode),message:correct?'Brilliant! Your special move is ready!':`Keep going! ${problem.expression} = ${problem.answer}.`,hint:correct?null:problem.hint};
 await tx`INSERT INTO game_math_answers(run_id,question_index,answer,correct,request_key,response) VALUES(${run.id},${b.index},${b.answer},${correct},${b.key},${tx.json(response)})`;
 await tx`UPDATE game_runs SET score=${state.correct} WHERE id=${run.id}`;
 await tx`INSERT INTO game_math_races(run_id,state) VALUES(${run.id},${tx.json(state)}) ON CONFLICT(run_id) DO UPDATE SET state=excluded.state,updated_at=now()`;
 return response;
});}
