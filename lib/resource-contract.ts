import {z} from 'zod';import {GRADES} from './worksheet-authoring';
export const RESOURCE_KINDS={pdf:'PDF',document:'Word document',slides:'Presentation',video:'Video',link:'External link'};
export const resourceMetadataSchema=z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().max(6000),subject:z.enum(['math','reading','writing','science','social_studies']),grade:z.enum(['all',...GRADES]),topic:z.string().trim().max(100),studentIds:z.array(z.string().uuid()).max(100).refine(ids=>new Set(ids).size===ids.length)}).strict();
export type ResourceMetadata=z.infer<typeof resourceMetadataSchema>;
export type Resource={id:string;title:string;description:string;subject_code:string;grade:string;topic:string;kind:keyof typeof RESOURCE_KINDS;source_url:string|null;original_filename:string|null;mime_type:string|null;bytes:number|null;revision:number;deleted_at:string|null;created_at:string;updated_at:string;preview_key?:string|null;reviewed_revision?:number|null;reviewed_at?:string|null;first_opened_at?:string|null;assigned_count?:number;unanswered?:number};
export type ResourceQuestion={id:string;body:string;student_id:string;nickname:string;created_at:string;updated_at:string;last_student_at:string;last_parent_at:string|null;resolved_at:string|null;reply_count:number};
export type ResourceReply={id:string;body:string;author_role:'parent'|'student';created_at:string};
export function externalVideo(value:string){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use an HTTPS video or reference link.');
 const host=url.hostname.toLowerCase();let id='';
 if(host==='youtu.be')id=url.pathname.slice(1).split('/')[0];
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=url.searchParams.get('v')||url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]||'';
 if(/^[a-zA-Z0-9_-]{11}$/.test(id))return {url:url.href,embed:`https://www.youtube-nocookie.com/embed/${id}`,provider:'YouTube'};
 if(['facebook.com','www.facebook.com','m.facebook.com','fb.watch','www.fb.watch'].includes(host))return {url:url.href,embed:`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`,provider:'Facebook'};
 if(['vimeo.com','www.vimeo.com'].includes(host)&&/^\/\d+/.test(url.pathname))return {url:url.href,embed:`https://player.vimeo.com/video/${url.pathname.split('/')[1]}`,provider:'Vimeo'};
 return {url:url.href,embed:null,provider:'External source'};
}
export const resourceUrlSchema=z.string().trim().max(2000).url().refine(value=>{try{externalVideo(value);return true;}catch{return false;}},'Use an HTTPS URL without embedded credentials.');
export function resourceRange(value:string|null,size:number){if(!value)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||(!match[1]&&!match[2]))throw Error('INVALID_RANGE');const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw Error('INVALID_RANGE');return {start,end};}
export const listPage=(value?:string)=>value&&/^\d{1,8}$/.test(value)?Math.max(1,Number(value)):1;
