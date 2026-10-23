import {z} from 'zod';
import {authorQuestionSchema,emptyAuthorDraft,emptyAuthorQuestion,QUESTION_TYPES,type AuthorDraft} from './worksheet-authoring';
export const extractedWorksheetSchema=z.object({title:z.string().min(1).max(200),questions:z.array(authorQuestionSchema).min(1).max(50),warnings:z.array(z.string().max(2000)).max(100)}).strict();
export type ExtractedWorksheet=z.infer<typeof extractedWorksheetSchema>;
export function uploadDrafts(extraction:ExtractedWorksheet,grade:AuthorDraft['grade'],subject:AuthorDraft['subject']){
 const drafts:AuthorDraft[]=[];
 for(let start=0;start<extraction.questions.length;start+=10){
  const draft=emptyAuthorDraft();draft.title=(extraction.title+(extraction.questions.length>10?` · Worksheet ${drafts.length+1}`:'')).slice(0,200);draft.grade=grade;draft.subject=subject;
  draft.description='Imported from a private worksheet upload. Review the question text and every answer key against the original before assigning.';
  const chunk=extraction.questions.slice(start,start+10);draft.questions=draft.questions.map((empty,i)=>chunk[i]?{...chunk[i],id:empty.id,text:chunk[i].text.replace(/(^|\n)\s*\d{1,3}[.)]\s+/g,'$1')}:empty);drafts.push(draft);
 }
 return drafts;
}
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const strings={type:'array',items:{type:'string'}};
const props:Record<string,unknown>=Object.fromEntries(Object.keys(emptyAuthorQuestion(0)).map(key=>[key,{type:'string'}]));
props.type={type:'string',enum:QUESTION_TYPES};props.answerKind={type:'string',enum:['number','option_id','option_ids','ordered_ids','boolean','text','rubric']};props.booleanValue={type:'string',enum:['','true','false']};
props.options={type:'array',items:object({id:{type:'string'},text:{type:'string'}})};
props.criteria={type:'array',items:object({label:{type:'string'},description:{type:'string'},weight:{type:'string'}})};props.selectedOptions=strings;
export const extractionResponseSchema=object({title:{type:'string'},questions:{type:'array',items:object(props)},warnings:strings});
