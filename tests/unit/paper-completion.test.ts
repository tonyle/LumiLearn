import {describe,it,expect} from 'vitest';
import {missingPaperQuestions} from '@/lib/paper-completion';
import type {PaperQuestion,PaperDraft,InkStroke} from '@/lib/paper';
const questions:PaperQuestion[]=[{id:'one',type:'number',prompt:{text:'1 + 1?'},options:[]},{id:'two',type:'handwriting',prompt:{text:'Draw a circle.'},options:[]}];
const pen:InkStroke={tool:'pen',points:[{x:.3,y:.5,p:.5},{x:.7,y:.5,p:.5}]};
describe('worksheet completion',()=>{
 it('lists whitespace and absent answers with global page numbers',()=>{expect(missingPaperQuestions(questions,{one:{text:'  \n',strokes:[]}},[],1)).toEqual([11,12]);});
 it('accepts typed answers, including zero, and visible pen strokes',()=>{expect(missingPaperQuestions(questions,{one:{text:'0',strokes:[]},two:{text:'',strokes:[pen]}})).toEqual([]);});
 it('does not count eraser-only marks or fully erased work',()=>{
  const erased:PaperDraft={one:{text:'',strokes:[{...pen,tool:'eraser'}]},two:{text:'',strokes:[pen,{...pen,tool:'eraser'}]}};expect(missingPaperQuestions(questions,erased)).toEqual([1,2]);
 });
 it('preserves partially erased ink and newly written answers',()=>{expect(missingPaperQuestions(questions,{one:{text:'',strokes:[pen,{tool:'eraser',points:[{x:.3,y:.5,p:.5}]}]},two:{text:'',strokes:[{...pen,tool:'eraser'},pen]}})).toEqual([]);});
 it('exempts locked correct answers but requires cleared corrections',()=>{expect(missingPaperQuestions(questions,{},[{questionId:'one',status:'correct',points:10},{questionId:'two',status:'incorrect',points:0}])).toEqual([2]);});
});
