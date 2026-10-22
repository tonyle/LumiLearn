import {z} from 'zod';
import {questionSetSchema,type QuestionSet} from './question-contract';
export const QUESTION_TYPES=['number','single_choice','multiple_choice','short_text','true_false','ordering','long_text','handwriting'] as const;
export const TYPE_LABELS:Record<typeof QUESTION_TYPES[number],string>={number:'Number',single_choice:'Choose one',multiple_choice:'Choose all that apply',short_text:'Short answer',true_false:'True or false',ordering:'Put in order',long_text:'Written explanation',handwriting:'Drawing / handwriting'};
export const SUBJECTS={math:'Mathematics',reading:'Words & reading',writing:'Writing',science:'Science',social_studies:'Social studies'};
export const GRADES=['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12'] as const;
const answerKinds=['number','option_id','option_ids','ordered_ids','boolean','text','rubric'] as const;
export const authorQuestionSchema=z.object({
 id:z.string().min(1).max(60),type:z.enum(QUESTION_TYPES),text:z.string().max(12000),
 options:z.array(z.object({id:z.string().min(1).max(60),text:z.string().max(1000)}).strict()).max(8),
 answerKind:z.enum(answerKinds),numberValue:z.string().max(100),tolerance:z.string().max(100),unit:z.string().max(32),
 accepted:z.string().max(12000),selectedOptions:z.array(z.string().max(60)).max(8),order:z.string().max(500),booleanValue:z.enum(['','true','false']),
 criteria:z.array(z.object({label:z.string().max(200),description:z.string().max(4000),weight:z.string().max(30)}).strict()).min(1).max(10),sampleAnswer:z.string().max(12000),
 reasoning:z.string().max(12000),steps:z.string().max(12000),translationVi:z.string().max(12000),
}).strict();
export const authorDraftSchema=z.object({title:z.string().max(200),description:z.string().max(2000),grade:z.enum(GRADES),subject:z.enum(['math','reading','writing','science','social_studies']),difficulty:z.enum(['review','grade_level','advanced']),questions:z.array(authorQuestionSchema).length(10)}).strict();
export type AuthorQuestion=z.infer<typeof authorQuestionSchema>;export type AuthorDraft=z.infer<typeof authorDraftSchema>;
export type LearnerChoice={id:string;nickname:string;grade:string};
export function emptyAuthorQuestion(index:number):AuthorQuestion{return {id:`q${String(index+1).padStart(2,'0')}`,type:'number',text:'',options:[{id:'a',text:''},{id:'b',text:''}],answerKind:'number',numberValue:'',tolerance:'0',unit:'',accepted:'',selectedOptions:[],order:'',booleanValue:'',criteria:[{label:'Correct response',description:'',weight:'1'}],sampleAnswer:'',reasoning:'',steps:'',translationVi:''};}
export function emptyAuthorDraft():AuthorDraft{return {title:'',description:'',grade:'3',subject:'math',difficulty:'grade_level',questions:Array.from({length:10},(_,i)=>emptyAuthorQuestion(i))};}
export function defaultAnswerKind(type:AuthorQuestion['type']):AuthorQuestion['answerKind']{return ({number:'number',single_choice:'option_id',multiple_choice:'option_ids',short_text:'text',true_false:'boolean',ordering:'ordered_ids',long_text:'rubric',handwriting:'rubric'} as const)[type];}
function number(value:string){return value.trim()?Number(value):NaN;}
function lines(value:string){return value.split('\n').map(v=>v.trim()).filter(Boolean);}
export function authorToQuestionSet(draft:AuthorDraft,setId='manual-preview'):unknown {
 return {schemaVersion:'1.0.0',setId,title:draft.title.trim(),description:draft.description.trim(),locale:'en-US',grade:draft.grade,subject:draft.subject,source:{type:'manual',referenceUrls:[],documentIds:[]},curriculum:{framework:'TEKS',standardCodes:[],alignmentStatus:'unverified'},questions:draft.questions.map(q=>{
  const kind=q.type==='handwriting'?q.answerKind:defaultAnswerKind(q.type);
  let answer:unknown;
  if(kind==='number')answer={kind,value:number(q.numberValue),tolerance:number(q.tolerance),unit:q.unit.trim()||null};
  else if(kind==='text')answer={kind,accepted:lines(q.accepted),normalization:'trim_casefold'};
  else if(kind==='boolean')answer={kind,value:q.booleanValue===''?null:q.booleanValue==='true'};
  else if(kind==='option_id')answer={kind,optionId:q.selectedOptions[0]||''};
  else if(kind==='option_ids')answer={kind,optionIds:q.selectedOptions};
  else if(kind==='ordered_ids')answer={kind,orderedIds:q.order.split(/[,;>\s]+/).filter(Boolean).map(token=>/^[a-h]$/i.test(token)?q.options[token.toUpperCase().charCodeAt(0)-65]?.id??token:token)};
  else answer={kind,criteria:q.criteria.map(c=>({label:c.label.trim(),description:c.description.trim(),weight:number(c.weight)})),sampleAnswer:q.sampleAnswer.trim()};
  const choices=['option_id','option_ids','ordered_ids'].includes(kind)?q.options.map(o=>({id:o.id,text:o.text.trim()})):[];
  const expected=kind==='number'?q.numberValue:kind==='text'?lines(q.accepted).join(' / '):kind==='boolean'?q.booleanValue:kind==='rubric'?q.sampleAnswer:kind==='ordered_ids'?q.order:q.selectedOptions.map(id=>q.options.find(o=>o.id===id)?.text||id).join(', ');
  return {externalId:q.id,type:q.type,prompt:{format:'plain',text:q.text.trim(),translationPolicy:q.translationVi.trim()?'allowed':'disabled'},grade:draft.grade,subject:draft.subject,difficulty:draft.difficulty,tags:[],standardCodes:[],options:choices,answer,grading:{mode:kind==='rubric'?'ai':'deterministic',maxAttempts:3},parentExplanation:{reasoning:q.reasoning.trim()||`Expected response: ${expected.trim()}`,steps:lines(q.steps)},...(q.translationVi.trim()?{studentTranslation:{vi:q.translationVi.trim()}}:{}),assets:[],metadata:{}};
 })};
}
export function validateAuthorDraft(draft:AuthorDraft,setId?:string){
 const parsed=questionSetSchema.safeParse(authorToQuestionSet(draft,setId));
 if(!parsed.success)return parsed;
 // Rubrics and ordering need substantive, complete answers, beyond structural validation.
 const extra:z.ZodIssue[]=[];
 parsed.data.questions.forEach((q,index)=>{
  if(q.answer.kind==='rubric')q.answer.criteria.forEach((c,n)=>{if(!c.label.trim()||!c.description.trim())extra.push({code:'custom',path:['questions',index,'answer','criteria',n],message:'Describe what makes this response correct.'});});
  if(q.answer.kind==='ordered_ids'&&(q.answer.orderedIds.length!==q.options.length||new Set(q.answer.orderedIds).size!==q.options.length))extra.push({code:'custom',path:['questions',index,'answer'],message:'Include every option exactly once in the correct order.'});
  if(q.answer.kind==='option_ids'&&new Set(q.answer.optionIds).size!==q.answer.optionIds.length)extra.push({code:'custom',path:['questions',index,'answer'],message:'Choose each correct answer only once.'});
 });
 return extra.length?{success:false as const,error:new z.ZodError(extra)}:{success:true as const,data:parsed.data};
}
export function describeAnswer(q:QuestionSet['questions'][number]){const a=q.answer;switch(a.kind){case 'number':return `${a.value}${a.unit?` ${a.unit}`:''}${a.tolerance?` (±${a.tolerance})`:''}`;case 'boolean':return a.value?'True':'False';case 'text':return a.accepted.join(' / ');case 'option_id':return q.options.find(o=>o.id===a.optionId)?.text||a.optionId;case 'option_ids':return a.optionIds.map(id=>q.options.find(o=>o.id===id)?.text||id).join('; ');case 'ordered_ids':return a.orderedIds.map(id=>q.options.find(o=>o.id===id)?.text||id).join(' → ');case 'rubric':return a.sampleAnswer;}}
export function browserRequestKey(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');}
