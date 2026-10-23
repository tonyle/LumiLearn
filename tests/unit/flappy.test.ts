import {expect,it} from 'vitest';import {newFlight,stepFlight,replayFlight,difficulty} from '@/lib/flappy';
it('replays the same seed and flap inputs deterministically',()=>{const s=newFlight(42),flaps:number[]=[];for(let i=0;i<1500&&!s.dead;i++){const flap=s.y>260&&s.vy>0;if(flap)flaps.push(s.tick);stepFlight(s,flap);}expect(replayFlight(42,s.tick,flaps)).toEqual(s);expect(s.score).toBeGreaterThan(0);});
it('caps the challenge at a generous gap and moderate speed',()=>{expect(difficulty(0)).toEqual({speed:110,gap:215});expect(difficulty(10000)).toEqual({speed:175,gap:170});});
it('ends a flight on the ground and does not advance a dead bird',()=>{const s=replayFlight(1,300,[]);expect(s.dead).toBe(true);const tick=s.tick;stepFlight(s,true);expect(s.tick).toBe(tick);expect(s.score).toBe(0);});

import {timedReplay} from '@/lib/flappy';
it('clips a final frame beyond the time limit instead of losing the score',()=>{expect(timedReplay(42,3604,[0,20,3599,3600,3603],61,60)).toEqual(replayFlight(42,3600,[0,20,3599]));expect(()=>timedReplay(42,3700,[],61,60)).toThrow('REPLAY');expect(()=>timedReplay(42,60,[20,20],2,60)).toThrow('REPLAY');});
