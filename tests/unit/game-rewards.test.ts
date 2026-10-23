import {it,expect} from 'vitest';
import {worksheetReward} from '@/lib/game-rewards';
it('awards score tiers without rounding across boundaries',()=>{for(const [score,points] of [[100,3],[99,2],[90,2],[80,2],[79,1],[70,1],[69,0],[0,0]])expect(worksheetReward(score,100)).toBe(points);expect(worksheetReward(7,10)).toBe(1);expect(worksheetReward(0,0)).toBe(0);expect(worksheetReward(101,100)).toBe(0);});
