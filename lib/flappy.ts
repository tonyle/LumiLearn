// Shared fixed-step simulation: the server computes every leaderboard score from the flap replay.
export const FLY_W=420,FLY_H=600,FLY_STEP=1/60;
export type FlyState={tick:number,y:number,vy:number,pipes:{x:number;y:number;passed:boolean}[],score:number,dead:boolean,seed:number};
export function newFlight(seed:number):FlyState{const s:FlyState={tick:0,y:260,vy:0,pipes:[],score:0,dead:false,seed:seed>>>0};s.pipes.push({x:340,y:230+random(s)*60,passed:false});return s;}
function random(s:FlyState){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function difficulty(score:number){return {speed:Math.min(175,110+score*2),gap:Math.max(170,215-score*1.5)};}
export function stepFlight(s:FlyState,flap:boolean){if(s.dead)return;const d=difficulty(s.score);if(flap)s.vy=-285;s.vy+=720*FLY_STEP;s.y+=s.vy*FLY_STEP;if(s.tick>0&&s.tick%115===0)s.pipes.push({x:FLY_W+30,y:145+random(s)*250,passed:false});for(const p of s.pipes){p.x-=d.speed*FLY_STEP;if(!p.passed&&p.x+64<100){p.passed=true;s.score++;}if(p.x<115&&p.x+64>85&&(s.y-12<p.y-d.gap/2||s.y+12>p.y+d.gap/2))s.dead=true;}s.pipes=s.pipes.filter(p=>p.x> -70);if(s.y<15||s.y>535)s.dead=true;s.tick++;}
export function replayFlight(seed:number,ticks:number,flaps:number[]){const s=newFlight(seed),input=new Set(flaps);for(let i=0;i<ticks&&!s.dead;i++)stepFlight(s,input.has(i));return s;}

// A final animation frame may straddle the deadline. Discard those extra ticks,
// but reject fast-forwarded or unordered inputs. Extra ticks never earn points.
export function replayBounds(ticks:number,flaps:number[],elapsed:number,seconds:number){
 if(ticks>Math.min(elapsed+1,seconds+.1)*60||flaps.some((t,i)=>t>=ticks||(i>0&&t<=flaps[i-1])))throw Error('REPLAY');
 return Math.min(ticks,Math.floor(seconds*60));
}

export function timedReplay(seed:number,ticks:number,flaps:number[],elapsed:number,seconds:number){const limit=replayBounds(ticks,flaps,elapsed,seconds);return replayFlight(seed,limit,flaps.filter(t=>t<limit));}
