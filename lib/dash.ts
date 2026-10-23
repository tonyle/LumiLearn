import type {FlyState} from './flappy';
export const DASH_FLOOR=500,DASH_CUBE=16;
export function dashDifficulty(score:number){return {speed:Math.min(260,180+score*2)};}
export function newDash(seed:number):FlyState{return {tick:0,y:DASH_FLOOR-DASH_CUBE,vy:0,pipes:[{x:340,y:36,passed:false}],score:0,dead:false,seed:seed>>>0};}
export function spikeWidth(height:number){return height>45?62:38;}
export function stepDash(s:FlyState,jump:boolean){if(s.dead)return;const grounded=s.y>=DASH_FLOOR-DASH_CUBE;if(jump&&grounded)s.vy=-520;s.vy+=1500/60;s.y+=s.vy/60;if(s.y>=DASH_FLOOR-DASH_CUBE){s.y=DASH_FLOOR-DASH_CUBE;s.vy=0;}const speed=dashDifficulty(s.score).speed;if(s.tick>0&&s.tick%90===0){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;s.pipes.push({x:450,y:s.seed%3===0?48:36,passed:false});}for(const p of s.pipes){p.x-=speed/60;const width=spikeWidth(p.y);if(!p.passed&&p.x+width<84){p.passed=true;s.score++;}if(p.x<114&&p.x+width>86){const apex=p.x+width/2,nearest=Math.max(86,Math.min(114,apex));const height=p.y*Math.max(0,1-Math.abs(nearest-apex)/(width/2));if(s.y+14>DASH_FLOOR-height&&s.y-14<DASH_FLOOR)s.dead=true;}}s.pipes=s.pipes.filter(p=>p.x> -70);s.tick++;}
export function replayDash(seed:number,ticks:number,jumps:number[]){const s=newDash(seed),input=new Set(jumps);for(let i=0;i<ticks&&!s.dead;i++)stepDash(s,input.has(i));return s;}
