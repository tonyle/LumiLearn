import {z} from 'zod';
import {authorQuestionSchema,emptyAuthorDraft,emptyAuthorQuestion,QUESTION_TYPES,type AuthorDraft} from './worksheet-authoring';
export const extractedWorksheetSchema=z.object({title:z.string().min(1).max(200),questions:z.array(authorQuestionSchema).min(1).max(50),warnings:z.array(z.string().max(2000)).max(100)}).strict();
export type ExtractedWorksheet=z.infer<typeof extractedWorksheetSchema>;
export function uploadDrafts(extraction:ExtractedWorksheet,grade:AuthorDraft['grade'],subject:AuthorDraft['subject']){
 const draft=emptyAuthorDraft();draft.title=extraction.title;draft.grade=grade;draft.subject=subject;
 draft.description='Imported from a private worksheet upload. Review every question and answer key against the original before assigning.';
 draft.questions=extraction.questions.map((q,i)=>({...q,id:emptyAuthorQuestion(i).id,text:q.text.replace(/(^|\n)\s*\d{1,3}[.)]\s+/g,'$1')}));
 return [draft];
}

const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const strings={type:'array',items:{type:'string'}};
const props:Record<string,unknown>=Object.fromEntries(Object.keys(emptyAuthorQuestion(0)).map(key=>[key,{type:'string'}]));
props.type={type:'string',enum:QUESTION_TYPES};props.answerKind={type:'string',enum:['number','option_id','option_ids','ordered_ids','boolean','text','rubric']};props.booleanValue={type:'string',enum:['','true','false']};
props.options={type:'array',items:object({id:{type:'string'},text:{type:'string'}})};
props.criteria={type:'array',items:object({label:{type:'string'},description:{type:'string'},weight:{type:'string'}})};props.selectedOptions=strings;
export const extractionResponseSchema=object({title:{type:'string'},questions:{type:'array',items:object(props)},warnings:strings});
