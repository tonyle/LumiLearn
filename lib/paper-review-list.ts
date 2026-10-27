import {z} from 'zod';
export const REVIEW_PAGE_SIZE=15;
export const REVIEW_STATUSES={all:'All statuses',attention:'Needs attention',needs_review:'Needs review',failed:'Grading failed',processing:'Grading',graded:'Graded',draft:'Drafts'} as const;
const date=z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Choose a valid date.');
const schema=z.object({q:z.string().trim().max(100).default(''),student:z.union([z.literal(''),z.string().uuid()]).default(''),grade:z.enum(['','K','1','2','3','4','5','6','7','8','9','10','11','12']).default(''),subject:z.enum(['','math','science','reading','writing','social_studies']).default(''),status:z.enum(['all','attention','needs_review','failed','processing','graded','draft']).default('all'),from:date.default(''),to:date.default(''),sort:z.enum(['priority','newest','oldest']).default('priority'),page:z.coerce.number().int().min(1).max(100000).default(1)}).refine(v=>!v.from||!v.to||v.from<=v.to,'The start date must be before the end date.');
export type ReviewFilters=z.infer<typeof schema>;
export function reviewFilters(params:Record<string,string|string[]|undefined>){return schema.parse(Object.fromEntries(Object.keys(schema.innerType().shape).flatMap(k=>typeof params[k]==='string'&&params[k]!==''?[[k,params[k]]]:[])));}
export function reviewHref(f:ReviewFilters,page=f.page){const params=new URLSearchParams();for(const [k,v] of Object.entries({...f,page}))if(v&&!(k==='status'&&v==='all')&&!(k==='sort'&&v==='priority')&&!(k==='page'&&v===1))params.set(k,String(v));return `/parent/paper${params.size?'?'+params:''}`;}
export function reviewDate(value:string|Date){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));}
export type ReviewRow={id:string;page_index:number;status:string;updated_at:string;nickname:string;grade:string;title:string;subjects:string[];question_count:number;correct:number;unresolved:number};

export function reviewBackHref(value?:string){if(!value)return '/parent/paper';try{const u=new URL(value,'http://local');return u.origin==='http://local'&&u.pathname==='/parent/paper'?u.pathname+u.search:'/parent/paper';}catch{return '/parent/paper';}}
