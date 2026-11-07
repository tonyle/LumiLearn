import {describe,it,expect} from 'vitest';
import {appendActivityStroke, floodRegion, snapshotSize} from '../../lib/book-activity-drawing';
describe('activity drawing',()=>{
 it('keeps typed work and refuses excess commands',()=>{
 const stroke={tool:'pen' as const,color:'#000000',width:2,points:[{x:0,y:0}]};
 const answer={text:'keep me',strokes:Array(400).fill(stroke)};
 expect(appendActivityStroke(answer,stroke)).toBe(answer);
 expect(appendActivityStroke({text:'keep me',strokes:[]},stroke).text).toBe('keep me');
 });
 it('refuses commands beyond the point budget without changing existing ink',()=>{
 const stroke={tool:'pen' as const,color:'#000000',width:2,points:Array(1000).fill({x:.2,y:.2})};
 const answer={text:'existing',strokes:Array(40).fill(stroke)};
 expect(appendActivityStroke(answer,{...stroke,points:[{x:.5,y:.5}]})).toBe(answer);
 });
 it('fits snapshots without distorting tall regions',()=>{expect(snapshotSize(2000,6000)).toEqual({width:667,height:2000});});
 it('fills only the connected seed region across original boundaries',()=>{
 const pixels=new Uint8ClampedArray(5*3*4).fill(255);
 for(let y=0;y<3;y++){const n=(y*5+2)*4; pixels[n]=pixels[n+1]=pixels[n+2]=0;}
 const mask=floodRegion(pixels,5,3,0,1);
 expect([...mask]).toEqual([1,1,0,0,0,1,1,0,0,0,1,1,0,0,0]);
 });
});
