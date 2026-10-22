import {pageLayout,type PaperDraft,type PaperQuestion,type PaperResult} from './paper';

// A small ink mask accounts for erasing, rather than counting eraser gestures as answers.
function hasInk(answer:PaperDraft[string],width:number,height:number){
  const scale=128/width,rows=Math.ceil(height*scale),mask=new Uint8Array(128*rows);
  let marked=0;
  for(const stroke of answer.strokes){
    const erase=stroke.tool==='eraser',radius=erase?10*scale:Math.max(.75,1.2*scale);
    for(let i=0;i<stroke.points.length;i++){
      const a=stroke.points[Math.max(0,i-1)],b=stroke.points[i];
      const ax=a.x*127,ay=a.y*(rows-1),bx=b.x*127,by=b.y*(rows-1),dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
      for(let y=Math.max(0,Math.floor(Math.min(ay,by)-radius));y<=Math.min(rows-1,Math.ceil(Math.max(ay,by)+radius));y++){
        for(let x=Math.max(0,Math.floor(Math.min(ax,bx)-radius));x<=Math.min(127,Math.ceil(Math.max(ax,bx)+radius));x++){
          const t=length?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length)):0;
          if((x-ax-t*dx)**2+(y-ay-t*dy)**2>radius*radius)continue;
          const index=y*128+x,next=erase?0:1;marked+=next-mask[index];mask[index]=next;
        }
      }
    }
  }
  return marked>0;
}
export function missingPaperQuestions(questions:PaperQuestion[],draft:PaperDraft,results:PaperResult[]=[],pageIndex=0){
  return pageLayout(questions,pageIndex*10+1).filter(cell=>{
    if(results.some(r=>r.questionId===cell.question.id&&r.status==='correct'))return false;
    const answer=draft[cell.question.id];
    return !answer||(!answer.text.trim()&&!hasInk(answer,cell.width,cell.height));
  }).map(cell=>cell.number);
}
