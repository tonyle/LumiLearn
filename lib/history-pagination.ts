export const PARENT_HISTORY_PAGE_SIZE=15;
export function parentHistoryPage(value?:string){return value&&/^\d{1,8}$/.test(value)?Math.max(1,Number(value)):1;}
export function parentHistoryHref(student:string,date:string,page=1,earlierPage=1){return `/parent/history?${new URLSearchParams({student,date,...(page>1?{page:String(page)}:{}),...(earlierPage>1?{earlierPage:String(earlierPage)}:{})})}`;}
