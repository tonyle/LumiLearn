export const STUDENT_SUBJECTS=[{code:'math',label:'Mathematics'},{code:'science',label:'Science'},{code:'reading',label:'Words & reading'},{code:'writing',label:'Writing'},{code:'social_studies',label:'Social studies'}] as const;
export type StudentSubject=typeof STUDENT_SUBJECTS[number]['code'];
export function studentSubject(value?:string):StudentSubject{return STUDENT_SUBJECTS.find(s=>s.code===value)?.code??'math';}
export function subjectLabel(code:string){return STUDENT_SUBJECTS.find(s=>s.code===code)?.label??'Mathematics';}
export function subjectDescription(code:string){return code==='science'?'Explore the world around you. Observe, discover and explain your ideas.':code==='reading'?'Discover new words, practise reading and let your ideas grow.':code==='writing'?'Find your voice, build sentences and share your ideas.':code==='social_studies'?'Explore communities, places and the people who shape our world.':'Look for patterns, solve problems and show how you figured it out.';}
