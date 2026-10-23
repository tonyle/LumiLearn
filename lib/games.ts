import {worksheetReward} from './game-rewards';
import {randomInt} from 'node:crypto';
import {z} from 'zod';
import type postgres from 'postgres';
import {sql} from './db';
import {resourceSession,ResourceError} from './resource-store';
import {replayDash} from './dash';
import {replayBounds} from './flappy';
import {timedReplay} from './flappy';
import type {GameWallet} from '@/components/game-contract';
type Tx=postgres.TransactionSql;
export async function gameSession(request?:Request,role:'student'|'parent'='student'){const s=await resourceSession(request);if(s.role!==role)throw new ResourceError('FORBIDDEN','This action is not available.',403);return s;}
export async function walletLock(tx:Tx,id:string){await tx`INSERT INTO game_wallets(student_id) VALUES(${id}) ON CONFLICT DO NOTHING`;const [w]=await tx`SELECT * FROM game_wallets WHERE student_id=${id} FOR UPDATE`;return w;}
// One ledger entry per worksheet. Improved scores grant only the additional points.
export async function syncRewards(tx:Tx,id:string){await walletLock(tx,id);
 const candidates=await tx`SELECT s.assignment_id,
 count(*)::int question_count,
 count(*) FILTER(WHERE result.status IN ('correct','incorrect'))::int graded_count,
 count(*) FILTER(WHERE result.status='correct')::int correct_count
 FROM submissions s JOIN assignment_students ast ON ast.assignment_id=s.assignment_id AND ast.student_id=s.student_id
 JOIN assignment_questions aq ON aq.assignment_id=s.assignment_id
 LEFT JOIN LATERAL (
 SELECT r->>'status' status FROM paper_pages p CROSS JOIN LATERAL jsonb_array_elements(p.results) r
 WHERE p.submission_id=s.id AND p.status='graded' AND r->>'questionId'=aq.question_version_id::text
 ORDER BY p.updated_at DESC LIMIT 1
 ) result ON true
 WHERE s.student_id=${id} GROUP BY s.id,s.assignment_id`;
 let delta=0;
 for(const row of candidates){if(row.graded_count!==row.question_count)continue;
 const points=worksheetReward(Number(row.correct_count)*10,Number(row.question_count)*10);if(!points)continue;
 const [prior]=await tx`SELECT id,points FROM game_ledger WHERE student_id=${id} AND assignment_id=${row.assignment_id}`;
 if(prior){if(points>Number(prior.points)){delta+=points-Number(prior.points);await tx`UPDATE game_ledger SET points=${points},note='Worksheet score reward (highest earned tier)' WHERE id=${prior.id}`;}}
 else{await tx`INSERT INTO game_ledger(student_id,kind,points,assignment_id,note) VALUES(${id},'worksheet',${points},${row.assignment_id},'Worksheet score reward')`;delta+=points;}
 }
 if(delta)await tx`UPDATE game_wallets SET points=points+${delta} WHERE student_id=${id}`;
}

async function expire(tx:Tx,id:string){await tx`UPDATE game_runs SET ended_at=expires_at,used_seconds=reserved_seconds WHERE student_id=${id} AND ended_at IS NULL AND expires_at<=now()`;}
export async function gameWallet(id:string){return sql.begin(async tx=>{await syncRewards(tx,id);await expire(tx,id);const [w]=await tx`SELECT * FROM game_wallets WHERE student_id=${id}`;const [usage]=await tx`SELECT coalesce(sum(coalesce(used_seconds,reserved_seconds)),0)::int seconds FROM game_runs WHERE student_id=${id} AND started_at>=date_trunc('day',now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'`;const [active]=await tx`SELECT id,expires_at FROM game_runs WHERE student_id=${id} AND ended_at IS NULL`;return {...w,used_today:Number(usage.seconds),active:active||null,server_now:new Date().toISOString()} as unknown as GameWallet;});}
export const exchangeSchema=z.object({points:z.number().int().min(1).max(1000),key:z.string().uuid()}).strict();
export async function exchangeTime(id:string,body:z.infer<typeof exchangeSchema>){return sql.begin(async tx=>{await syncRewards(tx,id);const w=await walletLock(tx,id);const [prior]=await tx`SELECT * FROM game_ledger WHERE request_key=${body.key}`;if(prior){if(prior.student_id!==id||prior.kind!=='exchange'||prior.points!==-body.points)throw new ResourceError('CONFLICT','Use a new request key.',409);return;}if(!w.enabled)throw new ResourceError('LOCKED','Games are paused by your parent.',403);if(Number(w.points)<body.points)throw new ResourceError('POINTS','You need more learning points. Score at least 70/100 on a worksheet.',409);const seconds=body.points*Number(w.seconds_per_point);await tx`UPDATE game_wallets SET points=points-${body.points},seconds=seconds+${seconds} WHERE student_id=${id}`;await tx`INSERT INTO game_ledger(student_id,kind,points,seconds,request_key,note) VALUES(${id},'exchange',${-body.points},${seconds},${body.key},'Points exchanged for play time')`;});}
export async function startFlight(id:string,key:string,game:'flappy'|'dash'|'math20'|'mathfacts'='flappy'){return sql.begin(async tx=>{const w=await walletLock(tx,id);await expire(tx,id);const [prior]=await tx`SELECT * FROM game_runs WHERE request_key=${key}`;if(prior){if(prior.student_id!==id||prior.game_code!==game)throw new ResourceError('CONFLICT','Use a new request key.',409);if(prior.ended_at)throw new ResourceError('ENDED','Start a new flight.',409);return prior;}if(!w.enabled)throw new ResourceError('LOCKED','Games are paused by your parent.',403);const [active]=await tx`SELECT id FROM game_runs WHERE student_id=${id} AND ended_at IS NULL`;if(active)throw new ResourceError('ACTIVE','A flight is already running. Finish it or wait for its timer to expire.',409);const [usage]=await tx`SELECT coalesce(sum(coalesce(used_seconds,reserved_seconds)),0)::int seconds FROM game_runs WHERE student_id=${id} AND started_at>=date_trunc('day',now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'`;const seconds=Math.min(300,Number(w.seconds),Number(w.daily_limit_minutes)*60-Number(usage.seconds));if(seconds<1)throw new ResourceError('NO_TIME',Number(w.seconds)<1?'Play time is empty. Earn points by completing a worksheet, then exchange them for time.':'You have reached today’s play limit. Come back tomorrow.',409);await tx`UPDATE game_wallets SET seconds=seconds-${seconds} WHERE student_id=${id}`;const [run]=await tx`INSERT INTO game_runs(game_code,student_id,seed,expires_at,reserved_seconds,request_key) VALUES(${game},${id},${randomInt(1,2147483646)},now()+${seconds}*interval '1 second',${seconds},${key}) RETURNING *`;return run;});}
export const finishSchema=z.object({runId:z.string().uuid(),ticks:z.number().int().min(0).max(18000),flaps:z.array(z.number().int().min(0).max(18000)).max(1800)}).strict();
export async function finishFlight(id:string,body:z.infer<typeof finishSchema>){return sql.begin(async tx=>{await walletLock(tx,id);const [run]=await tx`SELECT *,extract(epoch FROM (now()-started_at))::float8 elapsed FROM game_runs WHERE id=${body.runId} AND student_id=${id} FOR UPDATE`;if(!run)throw new ResourceError('NOT_FOUND','Flight not found.',404);if(run.ended_at&&(run.verified||new Date(run.ended_at as string).getTime()!==new Date(run.expires_at as string).getTime()))return {score:Number(run.score),usedSeconds:Number(run.used_seconds)};const elapsed=Math.max(0,Number(run.elapsed)),used=Math.min(Number(run.reserved_seconds),Math.ceil(elapsed));let state;try{if(run.game_code==='math20'||run.game_code==='mathfacts'){state={score:Number(run.score)};}else{const ticks=replayBounds(body.ticks,body.flaps,elapsed,Number(run.reserved_seconds));state=run.game_code==='dash'?replayDash(Number(run.seed),ticks,body.flaps.filter(t=>t<ticks)):timedReplay(Number(run.seed),body.ticks,body.flaps,elapsed,Number(run.reserved_seconds));}}catch{throw new ResourceError('REPLAY','The flight could not be verified.',422);}await tx`UPDATE game_runs SET verified=true,ended_at=now(),used_seconds=${used},score=${state.score} WHERE id=${run.id}`;if(!run.ended_at)await tx`UPDATE game_wallets SET seconds=seconds+${Number(run.reserved_seconds)-used} WHERE student_id=${id}`;return {score:state.score,usedSeconds:used};});}
export async function topFly(game:'flappy'|'dash'|'math20'|'mathfacts'='flappy'){return sql`SELECT s.id,s.nickname,max(r.score)::int score FROM game_runs r JOIN students s ON s.id=r.student_id WHERE r.game_code=${game} AND r.ended_at IS NOT NULL AND r.score>0 AND s.active=true GROUP BY s.id,s.nickname ORDER BY score DESC,min(r.started_at),s.id LIMIT 10`;}
