import type {StudentSubject} from './student-subjects';
export const HISTORY_PAGE_SIZE=12;
export function historyPage(value?:string){return value&&/^\d{1,8}$/.test(value)?Math.max(1,Number(value)):1;}
export function historyListHref(basePath:string,subject:StudentSubject,date:string,page=1){return `${basePath}?${new URLSearchParams({subject,date,...(page>1?{page:String(page)}:{})})}`;}
