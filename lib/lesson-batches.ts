export function tenQuestionLessons(ids:string[],pool:string[]=ids){
 const unique=[...new Set(ids)],candidates=[...new Set([...unique,...pool])];
 if(!unique.length)return [];
 if(candidates.length<10)throw Error('At least ten distinct questions are needed to create a lesson.');
 const lessons:string[][]=[];
 for(let start=0;start<unique.length;start+=10){const batch=unique.slice(start,start+10);for(const id of candidates){if(batch.length===10)break;if(!batch.includes(id))batch.push(id);}lessons.push(batch);}
 return lessons;
}
