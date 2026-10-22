import type { PaperQuestion } from "./paper";
export type LetterSection={title:string;questions:PaperQuestion[];startNumber?:number};
export type LetterCell={question:PaperQuestion;number:number;x:number;y:number;width:number;height:number;prompt:string[];options:string[];contentBottom:number};
export type LetterSheet={title:string;sectionPage:number;sectionPages:number;cells:LetterCell[];svg:string};
const W=612,H=792,M=36,GAP=18,COL=(W-M*2-GAP)/2,TOP=112,BOTTOM=H-52;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function width(text:string,size:number){return [...text].reduce((sum,c)=>sum+(/[MW@%]/.test(c)?.98:/[ilI.,:;'!|]/.test(c)?.32:/\s/.test(c)?.34:/[A-Z]/.test(c)?.72:.61)*size,0);}
export function letterWrap(text:string,maxWidth:number,size:number){
 return text.split('\n').flatMap(paragraph=>{const lines:string[]=[];let line='';for(const word of paragraph.split(/\s+/)){if(line&&width(line+' '+word,size)>maxWidth){lines.push(line);line='';}if(width(word,size)>maxWidth){if(line)lines.push(line);line='';let part='';for(const char of word){if(width(part+char,size)>maxWidth){lines.push(part);part='';}part+=char;}line=part;}else line+=(line?' ':'')+word;}if(line||!lines.length)lines.push(line);return lines;});
}
function block(question:PaperQuestion,cellWidth=COL){
 const prompt=letterWrap(question.prompt.text,cellWidth-16,11.5);
 const options=question.type==='true_false'?['True / False (circle one)']:question.options.flatMap((o,i)=>letterWrap(`${String.fromCharCode(65+i)}. ${o.text}`,cellWidth-22,10.5));
 const content=24+prompt.length*14+options.length*12+(options.length?6:0);
 const answer=question.type==='handwriting'?110:question.type==='long_text'?84:question.type==='number'?52:question.type==='short_text'?40:28;
 return{prompt,options,content,minimum:content+answer+14};
}
function minimumHeight(questions:PaperQuestion[],columns=2){let height=0;for(let i=0;i<questions.length;i+=columns)height+=Math.max(...questions.slice(i,i+columns).map(q=>block(q,columns===1?W-M*2:COL).minimum))+10;return height-10;}
function drawSheet(title:string,cells:LetterCell[],page:number,pages:number){
 const titleLines=letterWrap(title,W-M*2,16).slice(0,2);
 const text=(x:number,y:number,value:string,size=11.5,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(value)}</text>`;
 const body=cells.map(cell=>{
  const content=[text(cell.x,cell.y+12,`${cell.number}.`,11,'font-weight="bold"'),text(cell.x+cell.width-48,cell.y+12,'10 points',8.5,'fill="#555"'),...cell.prompt.map((line,i)=>text(cell.x,cell.y+32+i*14,line)),...cell.options.map((line,i)=>text(cell.x+6,cell.y+32+cell.prompt.length*14+6+i*12,line,10.5))].join('');
  const answerY=cell.y+cell.contentBottom+8,bottom=cell.y+cell.height-8;
  let rules='';
  if(cell.question.type==='long_text'||cell.question.type==='short_text')for(let y=answerY+20;y<bottom;y+=20)rules+=`<line x1="${cell.x}" x2="${cell.x+cell.width}" y1="${y}" y2="${y}" stroke="#d4d4d4" stroke-width="0.45"/>`;
  else if(cell.question.type==='number')rules=text(cell.x,bottom-2,'Answer:',8.5,'fill="#666"')+`<line x1="${cell.x+38}" x2="${cell.x+cell.width}" y1="${bottom}" y2="${bottom}" stroke="#aaa" stroke-width="0.5"/>`;
  else if(cell.question.type==='handwriting')rules=`<rect x="${cell.x}" y="${answerY}" width="${cell.width}" height="${Math.max(30,bottom-answerY)}" fill="none" stroke="#c8c8c8" stroke-width="0.5" stroke-dasharray="2 4"/>`;
  return `<g>${content}${rules}<line x1="${cell.x}" x2="${cell.x+cell.width}" y1="${cell.y+cell.height+3}" y2="${cell.y+cell.height+3}" stroke="#ddd" stroke-width="0.4"/></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792"><rect width="612" height="792" fill="white"/><g font-family="DejaVu Serif,Georgia,serif" fill="#111">${titleLines.map((line,i)=>text(M,34+i*19,line,16,'font-weight="bold"')).join('')}${text(M,82,'Name: __________________________     Date: ______________',10)}${text(430,82,`Score: ____ / ${cells.length*10}`,10)}<line x1="36" x2="576" y1="96" y2="96" stroke="#333" stroke-width="0.6"/>${body}${text(M,774,'LumiLearn | Write your answers or circle the choices. No answer key included.',8,'fill="#666"')}${text(473,774,`Letter | ${page} / ${pages}`,8,'fill="#666"')}</g></svg>`;
}
export function letterSheets(sections:LetterSection[]):LetterSheet[]{
 const sheets:LetterSheet[]=[];
 for(const section of sections){
  const groups:{questions:PaperQuestion[];offset:number;columns:number}[]=[];let offset=0;
  while(offset<section.questions.length){
   const remaining=section.questions.slice(offset);let pageCount=Math.ceil(remaining.length/10),count=Math.ceil(remaining.length/pageCount);
   while(count>1&&minimumHeight(remaining.slice(0,count))>BOTTOM-TOP){pageCount++;count=Math.ceil(remaining.length/pageCount);}
   const columns=count===1?1:2;
   if(minimumHeight(remaining.slice(0,count),columns)>BOTTOM-TOP)throw Error('PRINT_QUESTION_TOO_LONG');
   groups.push({questions:remaining.slice(0,count),offset,columns});offset+=count;
  }
  groups.forEach((group,index)=>{
   const rows=Math.ceil(group.questions.length/group.columns),minimum=minimumHeight(group.questions,group.columns),extra=(BOTTOM-TOP-minimum)/rows;
   const cells:LetterCell[]=[];let y=TOP;
   for(let i=0;i<group.questions.length;i+=group.columns){
    const entries=group.questions.slice(i,i+group.columns),rowHeight=Math.max(...entries.map(q=>block(q,group.columns===1?W-M*2:COL).minimum))+extra;
    entries.forEach((question,j)=>{const data=block(question,group.columns===1?W-M*2:COL);cells.push({question,number:(section.startNumber??1)+group.offset+i+j,x:M+j*(COL+GAP),y,width:group.columns===1?W-M*2:COL,height:rowHeight,prompt:data.prompt,options:data.options,contentBottom:data.content});});
    y+=rowHeight+10;
   }
   sheets.push({title:section.title,sectionPage:index+1,sectionPages:groups.length,cells,svg:drawSheet(section.title,cells,index+1,groups.length)});
  });
 }
 return sheets;
}
