import {it,expect} from 'vitest';
import {adjustActivityArea} from '@/lib/book-activity-area';
const area={x:.2,y:.3,width:.5,height:.4};
it('moves an area without changing size and keeps it inside the page',()=>{expect(adjustActivityArea(area,'move',2,-2)).toEqual({x:.5,y:0,width:.5,height:.4});});
it('resizes a corner while anchoring the opposite corner',()=>{const result=adjustActivityArea(area,'nw',.1,.1);expect(result.x).toBeCloseTo(.3);expect(result.y).toBeCloseTo(.4);expect(result.width).toBeCloseTo(.4);expect(result.height).toBeCloseTo(.3);});
it('prevents a flipped or too-small area and keeps all edges bounded',()=>{for(const handle of ['nw','n','ne','e','se','s','sw','w'] as const){const result=adjustActivityArea(area,handle,2,2);expect(result.width).toBeGreaterThanOrEqual(.05);expect(result.height).toBeGreaterThanOrEqual(.05);expect(result.x+result.width).toBeLessThanOrEqual(1.000001);expect(result.y+result.height).toBeLessThanOrEqual(1.000001);}});
