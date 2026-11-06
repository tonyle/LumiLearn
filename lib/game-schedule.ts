// ISO weekdays match the parent calendar: Monday=1, Sunday=7.
export const GAME_DAYS=[{day:1,label:'Monday',short:'Mon'},{day:2,label:'Tuesday',short:'Tue'},{day:3,label:'Wednesday',short:'Wed'},{day:4,label:'Thursday',short:'Thu'},{day:5,label:'Friday',short:'Fri'},{day:6,label:'Saturday',short:'Sat'},{day:7,label:'Sunday',short:'Sun'}] as const;
export const ALL_GAME_DAYS=[1,2,3,4,5,6,7];
export function gameDay(now=new Date()){const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short'}).format(now);return GAME_DAYS.find(d=>d.short===weekday)!.day;}
export function gameDayAllowed(days:readonly number[],now=new Date()){return days.includes(gameDay(now));}
export function gameScheduleLabel(days:readonly number[]){return days.length===7?'Every day':days.length===0?'No play days':GAME_DAYS.filter(d=>days.includes(d.day)).map(d=>d.short).join(', ');}
