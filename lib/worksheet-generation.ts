import {z} from 'zod';
import {GRADES,authorDraftSchema,validateAuthorDraft,type AuthorDraft} from './worksheet-authoring';
import {extractedWorksheetSchema} from './upload-worksheet';
export const generationParametersSchema=z.object({grade:z.enum(GRADES),subject:z.enum(['math','reading','writing','science','social_studies']),topic:z.string().trim().min(2).max(500),count:z.number().int().min(1).max(10),difficulty:z.enum(['review','grade_level','advanced']),instructions:z.string().trim().max(2000)}).strict();
export type GenerationParameters=z.infer<typeof generationParametersSchema>;
export type GenerationItem={position:number;state:'pending'|'processing'|'ready'|'failed';draft_id:string|null;title:string|null;warnings:string[];error_code:string|null;started_at:string|null};
export type GenerationBatch={id:string;parameters:GenerationParameters;items:GenerationItem[]};
export const normalizeQuestion=(text:string)=>text.toLowerCase().replace(/\s+/g,' ').trim();
export function parseGeneratedWorksheet(value:unknown,parameters:GenerationParameters,position:number,previous:string[]=[]){
 const extracted=extractedWorksheetSchema.parse(value);
 const draft:AuthorDraft=authorDraftSchema.parse({title:`${extracted.title} · ${position+1}`.slice(0,200),description:`AI-generated practice: ${parameters.topic}. Review every question and answer before assigning. TEKS alignment is unverified.`,grade:parameters.grade,subject:parameters.subject,difficulty:parameters.difficulty,questions:extracted.questions.map((q,i)=>({...q,id:`q${String(i+1).padStart(2,'0')}`}))});
 const seen=new Set(previous.map(normalizeQuestion));
 for(const question of draft.questions){const key=normalizeQuestion(question.text);if(seen.has(key))throw Error('AI_DUPLICATE_QUESTIONS');seen.add(key);}
 if(!validateAuthorDraft(draft).success)throw Error('AI_INVALID_QUESTIONS');
 return {draft,warnings:extracted.warnings};
}
export function generationErrorMessage(code:string){
 if(code==='AI_DISABLED')return 'AI is not enabled. Check the external AI setting and server API key.';
 if(code==='BUDGET_LIMIT')return 'The monthly AI allowance has been reached. Finished worksheets are saved.';
 if(code==='AI_KEY_INVALID')return 'The server API key was rejected. Update OPENAI_API_KEY, then retry.';
 if(code==='AI_BILLING_LIMIT')return 'The OpenAI account has no available API credit. Check billing, then retry.';
 if(code==='AI_RATE_LIMIT')return 'OpenAI is busy. Wait a moment, then retry unfinished worksheets.';
 if(code==='GENERATION_BUSY')return 'This worksheet is already generating. Wait a moment, then continue.';
 return 'This worksheet could not be generated. Finished worksheets are saved; retry the unfinished ones.';
}
