import {it,expect} from 'vitest';
import {worksheetReward} from '@/lib/game-rewards';
it('awards score tiers without rounding across boundaries',()=>{for(const [score,points] of [[100,3],[99,2],[90,2],[80,2],[79,1],[70,1],[69,0],[0,0]])expect(worksheetReward(score,100)).toBe(points);expect(worksheetReward(7,10)).toBe(1);expect(worksheetReward(0,0)).toBe(0);expect(worksheetReward(101,100)).toBe(0);});
it('rewards completed vocabulary groups of ten with a three-point minimum',async()=>{const {vocabularyReward}=await import('@/lib/game-rewards');for(const [words,points] of [[0,0],[1,3],[9,3],[10,3],[15,3],[19,3],[20,6],[25,6],[30,9],[40,12],[49,12],[50,15],[51,0]])expect(vocabularyReward(words)).toBe(points);expect(vocabularyReward(NaN)).toBe(0);expect(vocabularyReward(10.5)).toBe(0);});
