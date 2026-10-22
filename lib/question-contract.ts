import { z } from "zod";

const noHtml = (s:string) => !/<\/?(?:script|iframe|object|embed|style|link|meta)\b/i.test(s);
const option = z.object({ id:z.string().min(1).max(60), text:z.string().min(1).max(1000).refine(noHtml,"unsafe HTML") }).strict();
const answer = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("option_id"),optionId:z.string().min(1)}).strict(),
  z.object({kind:z.literal("option_ids"),optionIds:z.array(z.string()).min(1)}).strict(),
  z.object({kind:z.literal("number"),value:z.number().finite(),tolerance:z.number().nonnegative(),unit:z.string().nullable().optional()}).strict(),
  z.object({kind:z.literal("text"),accepted:z.array(z.string().min(1)).min(1),normalization:z.enum(["trim_casefold","trim_only","exact"]).optional()}).strict(),
  z.object({kind:z.literal("ordered_ids"),orderedIds:z.array(z.string()).min(2)}).strict(),
  z.object({kind:z.literal("boolean"),value:z.boolean()}).strict(),
  z.object({kind:z.literal("rubric"),criteria:z.array(z.object({label:z.string().min(1),description:z.string().min(1),weight:z.number().min(0).max(1)}).strict()).min(1),sampleAnswer:z.string().min(1)}).strict()
]);
export const questionSchema = z.object({
  externalId:z.string().min(1).max(100), type:z.enum(["single_choice","multiple_choice","number","short_text","ordering","true_false","long_text","handwriting"]),
  prompt:z.object({format:z.enum(["plain","markdown"]),text:z.string().min(1).max(12000).refine(noHtml,"unsafe HTML"),translationPolicy:z.enum(["allowed","paragraph_only","disabled"])}).strict(),
  grade:z.string().min(1).max(12),subject:z.enum(["math","reading","writing","science","social_studies"]),difficulty:z.enum(["review","grade_level","advanced"]),
  tags:z.array(z.string().max(80)).max(30),standardCodes:z.array(z.string().max(80)).max(30),options:z.array(option).max(8),answer,
  grading:z.object({mode:z.enum(["deterministic","ai","parent_review"]),caseSensitive:z.boolean().optional(),maxAttempts:z.number().int().min(1).max(100)}).strict(),
  parentExplanation:z.object({reasoning:z.string().max(12000),steps:z.array(z.string().max(4000)).max(30)}).strict(),
  studentTranslation:z.object({vi:z.string().max(12000).refine(noHtml,"unsafe HTML")}).strict().optional(),
  assets:z.array(z.object({localRef:z.string().min(1).max(240).refine((v)=>!v.includes("..")&&!/^https?:/i.test(v),"remote/path traversal reference forbidden"),alt:z.string().max(500).optional()}).strict()).max(20),metadata:z.record(z.unknown()).default({})
}).strict().superRefine((q,ctx)=>{
  const ids=q.options.map(o=>o.id); if(new Set(ids).size!==ids.length) ctx.addIssue({code:"custom",path:["options"],message:"option IDs must be unique"});
  const expected:Record<string,string[]>={single_choice:["option_id"],multiple_choice:["option_ids"],number:["number"],short_text:["text"],ordering:["ordered_ids"],true_false:["boolean"],long_text:["rubric"],handwriting:["rubric","number","text","boolean","option_id","option_ids","ordered_ids"]};
  if(!expected[q.type].includes(q.answer.kind)) ctx.addIssue({code:"custom",path:["answer","kind"],message:`answer kind ${q.answer.kind} is invalid for ${q.type}`});
  if(["single_choice","multiple_choice","ordering"].includes(q.type)&&q.options.length<2) ctx.addIssue({code:"custom",path:["options"],message:"at least two options required"});
  const referenced=q.answer.kind==="option_id"?[q.answer.optionId]:q.answer.kind==="option_ids"?q.answer.optionIds:q.answer.kind==="ordered_ids"?q.answer.orderedIds:[];
  for(const id of referenced) if(!ids.includes(id)) ctx.addIssue({code:"custom",path:["answer"],message:`answer references missing option ${id}`});
  if(q.answer.kind==="rubric"&&Math.abs(q.answer.criteria.reduce((n,c)=>n+c.weight,0)-1)>0.001) ctx.addIssue({code:"custom",path:["answer","criteria"],message:"rubric weights must sum to 1"});
  const selectedOptionId=q.answer.kind==="option_id"?q.answer.optionId:null;
  const secretValues=q.answer.kind==="number"?[String(q.answer.value)]:q.answer.kind==="text"?q.answer.accepted:selectedOptionId?q.options.filter(o=>o.id===selectedOptionId).map(o=>o.text):[];
  if(q.studentTranslation&&secretValues.some(v=>v.length>1&&q.studentTranslation!.vi.toLocaleLowerCase().includes(v.toLocaleLowerCase()))) ctx.addIssue({code:"custom",path:["studentTranslation","vi"],message:"translation may expose an answer"});
});
export const questionSetSchema = z.object({
  schemaVersion:z.literal("1.0.0"),setId:z.string().min(1).max(120),title:z.string().min(1).max(200),description:z.string().max(2000).optional(),locale:z.string().min(2).max(20),grade:z.enum(["Pre-K","K","1","2","3","4","5","6","7","8","9","10","11","12"]),subject:z.enum(["math","reading","writing","science","social_studies"]),
  source:z.object({type:z.enum(["ai_generated","manual","worksheet","curriculum"]),generator:z.string().max(100).optional(),referenceUrls:z.array(z.string().url()).max(20).optional(),documentIds:z.array(z.string()).max(20).optional()}).strict(),
  curriculum:z.object({framework:z.string().max(50),standardCodes:z.array(z.string()).max(100),alignmentStatus:z.enum(["verified","unverified","general_practice"])}).strict(),questions:z.array(questionSchema).min(1).max(200)
}).strict().superRefine((set,ctx)=>{const ids=set.questions.map(q=>q.externalId);if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",path:["questions"],message:"externalId values must be unique"});});
export type QuestionSet=z.infer<typeof questionSetSchema>;
export function validateQuestionSet(input:unknown){return questionSetSchema.safeParse(input);}
export function zodIssues(error:z.ZodError){return error.issues.map(i=>({path:"/"+i.path.map(String).join("/"),message:i.message}));}
