import {meadowProblem} from './math-meadow';
export const MAGIC_TRACKS=['add5','add10','add20','tables2','tables5','tablesmix','decimals'] as const;
export type MagicTrack=typeof MAGIC_TRACKS[number];
export type MagicWord={id:string;word:string;imageId:string|null;symbol?:string};
export type MagicQuestion={id:string;kind:'math'|'word';prompt:string;audio?:string;imageId?:string|null;symbol?:string;options:{id:string;label:string;imageId?:string|null;symbol?:string}[];hint:string;answer:string;explanation:string};
export const MAGIC_TRACK_LABELS:Record<MagicTrack,string>={add5:'Add & subtract to 5',add10:'Add & subtract to 10',add20:'Add & subtract to 20',tables2:'Groups of 2',tables5:'Groups of 5',tablesmix:'Times tables 1–9',decimals:'Tenths with pictures'};
export function defaultMagicTrack(grade:string):MagicTrack{return Number(grade)>=5?'decimals':Number(grade)>=3?'tables2':'add5';}
export function magicMath(seed:number,index:number,track:MagicTrack,choices=3):MagicQuestion{
 let expression='',answer=0,hint='',explanation='';let scale=1;
 if(track==='decimals'){const a=1+Math.abs(seed+index*3)%7,b=1+Math.abs(seed+index*7)%3;answer=a+b;scale=10;expression=`${(a/10).toFixed(1)} + ${(b/10).toFixed(1)}`;hint=`Picture ${a} tenths and ${b} more tenths.`;explanation=`${a} tenths + ${b} tenths = ${answer} tenths (${(answer/10).toFixed(1)}).`;}
 else{for(let attempt=0;attempt<500;attempt++){const p=meadowProblem((seed+attempt*7919)>>>0,index,track.startsWith('tables')?'mathfacts':'math20');const operands=p.expression.match(/\d+/g)!.map(Number),cap=track==='add5'?5:track==='add10'?10:20;
   if(!track.startsWith('tables')&&(operands.some(n=>n>cap)||p.answer>cap))continue;
   if((track==='tables2'||track==='tables5')&&(!(p.expression.includes('÷')?operands[1]===(track==='tables2'?2:5):operands.includes(track==='tables2'?2:5))||p.answer>25))continue;
   ({expression,answer,hint}=p);break;}
  if(!expression){expression='2 + 1';answer=3;hint='Start at two and count one more.';}
  explanation=`${expression} = ${answer}. ${hint}`;
 }
 const format=(n:number)=>scale===10?(n/10).toFixed(1):String(n),correct=format(answer),values=[answer];for(let offset=1;values.length<choices;offset++){const value=answer+(offset%2?-Math.ceil(offset/2):offset/2);if(value>=0&&!values.includes(value))values.push(value);}
 const options=values.map(n=>({id:format(n),label:format(n)}));const rotate=Math.abs(seed+index)%options.length;options.push(...options.splice(0,rotate));
 return {id:`math-${seed}-${index}`,kind:'math',prompt:`${expression} = ?`,hint,answer:correct,explanation,options};
}
export const MAGIC_FALLBACK_WORDS:MagicWord[]=[{id:'cat',word:'cat',imageId:null,symbol:'🐈'},{id:'dog',word:'dog',imageId:null,symbol:'🐕'},{id:'sun',word:'sun',imageId:null,symbol:'☀️'},{id:'fish',word:'fish',imageId:null,symbol:'🐟'},{id:'tree',word:'tree',imageId:null,symbol:'🌳'}];
export function magicWord(seed:number,index:number,level:number,words:MagicWord[]):MagicQuestion{
 const pool=words.length>=2?words:MAGIC_FALLBACK_WORDS,w=pool[Math.abs(seed+index)%pool.length];const others=pool.filter(x=>x.id!==w.id).slice(0,level<=4?1:2),id=`word-${seed}-${index}`;
 if(level>=9&&level<=16&&w.word.length<=8){const missing=Math.min(1,w.word.length-1),letter=w.word[missing],alternatives=[letter,...'aeioust'.split('').filter(c=>c!==letter).slice(0,2)];const options=alternatives.map(c=>({id:c,label:c.toUpperCase()}));if((seed+index)%2)options.reverse();return {id,kind:'word',prompt:`Fill the missing letter: ${w.word.slice(0,missing)} _ ${w.word.slice(missing+1)}`,audio:w.word,imageId:w.imageId,symbol:w.symbol,hint:`Say “${w.word}” slowly. Notice its sounds.`,options,answer:letter,explanation:`${w.word} is spelled ${w.word.split('').join(' · ')}.`};}
 const options=[w,...others].map(x=>({id:x.id,label:level<9?x.word: x.word,imageId:level<9?x.imageId:undefined,symbol:level<9?x.symbol:undefined}));if((seed+index)%2)options.reverse();return {id,kind:'word',prompt:level<9?`Find the picture for “${w.word}”.`:'Listen, then choose the spelling.',audio:w.word,hint:`Say the word aloud: ${w.word}.`,options,answer:w.id,explanation:`The word is ${w.word}. ${w.word.split('').join(' · ')}.`};
}
export function publicMagicQuestion(q:MagicQuestion|null,showHelp=false){if(!q)return null;const {answer:_,explanation,...publicView}=q;void _;return {...publicView,explanation:showHelp?explanation:undefined};}
