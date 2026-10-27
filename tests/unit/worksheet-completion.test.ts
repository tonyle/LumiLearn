import {describe,it,expect} from 'vitest';
import {worksheetCompleted} from '@/lib/worksheet-completion';
describe('two-grading worksheet completion',()=>{
 const wrong=Array.from({length:10},()=>({status:'incorrect' as const}));
 it('keeps a worksheet open after its first non-perfect grading',()=>expect(worksheetCompleted(10,wrong,1)).toBe(false));
 it('completes after the second grading even at zero points',()=>expect(worksheetCompleted(10,wrong,2)).toBe(true));
 it('completes a perfect worksheet on its first grading',()=>expect(worksheetCompleted(10,wrong.map(()=>({status:'correct'})),1)).toBe(true));
 it('never completes a partially answered worksheet or an empty one',()=>{expect(worksheetCompleted(10,wrong.slice(1),2)).toBe(false);expect(worksheetCompleted(0,[],2)).toBe(false);});
});
