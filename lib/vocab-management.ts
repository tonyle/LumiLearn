import {z} from 'zod';
export const VOCAB_GRADES=['K','1','2','3','4','5','6','7','8','9','10','11','12'] as const;
export const vocabGrade=z.enum(VOCAB_GRADES).nullable().default(null);
export const VOCAB_PAGE_SIZE=12;
const day=z.string().refine(s=>!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Choose a valid date.');
const filters=z.object({q:z.string().trim().max(100).default(''),grade:z.enum(['','unclassified',...VOCAB_GRADES]).default(''),from:day.default(''),to:day.default(''),state:z.enum(['','ready','review','missing']).default(''),sort:z.enum(['newest','oldest','word']).default('newest'),page:z.coerce.number().int().min(1).max(10000).default(1)}).refine(f=>!f.from||!f.to||f.from<=f.to,'The start date must be before the end date.');
export type VocabFilters=z.infer<typeof filters>;
export function vocabListFilters(params:URLSearchParams){return filters.parse(Object.fromEntries(['q','grade','from','to','state','sort','page'].flatMap(k=>params.has(k)&&params.get(k)!==''?[[k,params.get(k)]]:[])));}
export const emptyVocabFilters:VocabFilters={q:'',grade:'',from:'',to:'',state:'',sort:'newest',page:1};
export function vocabFilterQuery(f:VocabFilters){return new URLSearchParams(Object.entries(f).map(([k,v])=>[k,String(v)])).toString();}
export function vocabDate(value:string|Date){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric'}).format(new Date(value));}
export function vocabErrorMessage(error:unknown){return error instanceof z.ZodError?error.issues[0]?.message||'Check the worksheet details.':error instanceof Error?error.message:'Please check the details and try again.';}
