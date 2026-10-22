// Explicit, small opt-in comparison. Sends synthetic ink only, never family work.
import sharp from 'sharp';import {randomUUID} from 'node:crypto';import {gradePaperImage} from '../../lib/ai/paper-grader';import {paperSvg,pageLayout,type PaperDraft} from '../../lib/paper';import type {GradingQuestion} from '../../lib/paper-grading';
const questions:GradingQuestion[]=[5,8].map((answer,i)=>({id:randomUUID(),number:i+1,type:'number',prompt:{text:i?'What is 6 + 2?':'What is 3 + 2?'},options:[],answer_key:{kind:'number',value:answer,tolerance:0},grading_policy:{}}));
const cells=pageLayout(questions,1);const draft:PaperDraft={};
const digits=[[[.85,.05],[.2,.05],[.15,.45],[.6,.4],[.85,.55],[.8,.85],[.55,.98],[.2,.9]],[[.1,.1],[.9,.1],[.45,.95]]];
for(let i=0;i<2;i++){const cell=cells[i];draft[questions[i].id]={text:'',strokes:[{tool:'pen',points:digits[i].map(([x,y])=>({x:(cell.answer.x-cell.x+30+x*30)/cell.width,y:(cell.answer.y-cell.y+15+y*45)/cell.height,p:.5}))}]};}
const png=await sharp(Buffer.from(paperSvg(questions,'Synthetic handwriting evaluation',0,draft))).png().toBuffer();
for(const model of ['gpt-6-luna','gpt-5-mini']){
 process.env.OPENAI_MODEL=model;
 try{const started=Date.now(),result=await gradePaperImage(png,questions);console.log(JSON.stringify({model,seconds:Math.round((Date.now()-started)/1000),inputTokens:result.inputTokens,outputTokens:result.outputTokens,verdicts:result.results.map(r=>r.status),expected:['correct','incorrect']}));}
 catch(error){console.log(JSON.stringify({model,error:error instanceof Error?error.message:'FAILED'}));if(error instanceof Error&&error.message==='AI_BILLING_LIMIT')break;}
}
