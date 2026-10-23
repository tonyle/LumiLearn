import type {StudentSubject} from './student-subjects';
export const WORKSHEET_PAGE_SIZE=12;
export const WORKSHEET_FILTERS=[{value:'todo',label:'To do'},{value:'in_progress',label:'In progress'},{value:'completed',label:'Completed'},{value:'all',label:'All worksheets'}] as const;
export type WorksheetFilter=typeof WORKSHEET_FILTERS[number]['value'];
export function worksheetFilter(value?:string):WorksheetFilter{return WORKSHEET_FILTERS.find(f=>f.value===value)?.value??'todo';}
export function worksheetPage(value?:string){return value&&/^\d{1,8}$/.test(value)?Math.max(1,Number(value)):1;}
export function worksheetListHref(basePath:string,subject:StudentSubject,status:WorksheetFilter,page=1){return `${basePath}?${new URLSearchParams({subject,status,...(page>1?{page:String(page)}:{})})}`;}
export function worksheetState(status:string|null){return status==='completed'?'Completed':status==='needs_review'?'Awaiting review':status?'In progress':'Not started';}
