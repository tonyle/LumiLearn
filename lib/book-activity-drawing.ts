import type {ActivityAnswer,ActivityPart,ActivityStroke} from './book-activity-contract';
export function snapshotSize(width:number,height:number){const scale=Math.min(1,1000/width,2000/height);return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
export function appendActivityStroke(answer:ActivityAnswer,stroke:ActivityStroke):ActivityAnswer{if(answer.strokes.length>=400||answer.strokes.reduce((n,s)=>n+s.points.length,0)+stroke.points.length>40000)return answer;return {...answer,strokes:[...answer.strokes,stroke]};}
/** A deterministic four-connected flood mask, comparing against the sampled seed. */
export function floodRegion(pixels:Uint8ClampedArray,width:number,height:number,x:number,y:number){
 const mask=new Uint8Array(width*height),seen=new Uint8Array(width*height),seed=Math.min(height-1,Math.max(0,y))*width+Math.min(width-1,Math.max(0,x)),queue=[seed]; seen[seed]=1;
 for(let head=0;head<queue.length;head++){const i=queue[head],p=i*4,s=seed*4;if(Math.abs(pixels[p]-pixels[s])+Math.abs(pixels[p+1]-pixels[s+1])+Math.abs(pixels[p+2]-pixels[s+2])+Math.abs(pixels[p+3]-pixels[s+3])>100)continue;mask[i]=1;for(const j of [i%width?i-1:-1,i%width<width-1?i+1:-1,i-width,i+width])if(j>=0&&j<mask.length&&!seen[j]){seen[j]=1;queue.push(j);}}
 return mask;
}
export function loadActivityImage(url:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Could not load the page image.'));image.src=url;});}
export function drawActivityStroke(ctx:CanvasRenderingContext2D,s:ActivityStroke){
 if(s.tool==='fill')return;const w=ctx.canvas.width,h=ctx.canvas.height,a=s.points[0],b=s.points.at(-1)!;if(!a)return;ctx.save();ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.globalAlpha=s.tool==='highlighter'?.3:1;ctx.strokeStyle=s.color;ctx.lineWidth=s.width*w/1000*(s.tool==='brush'?1.8:1);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 if(s.tool==='rectangle')ctx.rect(Math.min(a.x,b.x)*w,Math.min(a.y,b.y)*h,Math.abs(b.x-a.x)*w,Math.abs(b.y-a.y)*h);
 else if(s.tool==='ellipse')ctx.ellipse((a.x+b.x)*w/2,(a.y+b.y)*h/2,Math.abs(b.x-a.x)*w/2,Math.abs(b.y-a.y)*h/2,0,0,Math.PI*2);
 else {ctx.moveTo(a.x*w,a.y*h);if(s.tool==='line')ctx.lineTo(b.x*w,b.y*h);else {for(let i=1;i<s.points.length;i++){const p=s.points[i],previous=s.points[i-1];ctx.quadraticCurveTo(previous.x*w,previous.y*h,(previous.x+p.x)*w/2,(previous.y+p.y)*h/2);}ctx.lineTo(b.x*w+.01,b.y*h+.01);}}ctx.stroke();ctx.restore();
}
export function paintActivityFill(canvas:HTMLCanvasElement,stroke:ActivityStroke,image:HTMLImageElement,part:ActivityPart){
 const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height,merged=document.createElement('canvas');merged.width=w;merged.height=h;const base=merged.getContext('2d',{willReadFrequently:true});if(!base)return;
 base.drawImage(image,image.naturalWidth*part.x,image.naturalHeight*part.y,image.naturalWidth*part.width,image.naturalHeight*part.height,0,0,w,h);base.drawImage(canvas,0,0);
 const seed=stroke.points[0],mask=floodRegion(base.getImageData(0,0,w,h).data,w,h,Math.floor(seed.x*(w-1)),Math.floor(seed.y*(h-1))),layer=ctx.createImageData(w,h),rgb=stroke.color.match(/\w\w/g)!.map(v=>parseInt(v,16));for(let i=0;i<mask.length;i++)if(mask[i]){layer.data[i*4]=rgb[0];layer.data[i*4+1]=rgb[1];layer.data[i*4+2]=rgb[2];layer.data[i*4+3]=255;}base.putImageData(layer,0,0);ctx.drawImage(merged,0,0);
}
export function paintActivityInk(canvas:HTMLCanvasElement,answer:ActivityAnswer,image:HTMLImageElement,part:ActivityPart,includeText=true){
 const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);
 for(const stroke of answer.strokes){if(stroke.tool==='fill')paintActivityFill(canvas,stroke,image,part);else drawActivityStroke(ctx,stroke);}
 if(includeText)paintActivityText(ctx,answer.text,part.lines);
}
export function paintActivityText(ctx:CanvasRenderingContext2D,text:string,lines:number){
 const w=ctx.canvas.width,h=ctx.canvas.height,step=h/(lines+1),font=Math.min(step*.65,w*.035);ctx.save();ctx.fillStyle='#172554';ctx.font=`${font}px sans-serif`;ctx.textBaseline='alphabetic';let row=1;for(const paragraph of text.split('\n')){let line='';for(const character of paragraph){if(ctx.measureText(line+character).width>w*.94&&line){ctx.fillText(line,w*.03,row++*step);line='';}line+=character;}ctx.fillText(line,w*.03,row++*step);}ctx.restore();
}
export async function renderActivityInkPng(answer:ActivityAnswer,imageUrl:string,part:ActivityPart):Promise<string>{const image=await loadActivityImage(imageUrl),size=snapshotSize(image.naturalWidth*part.width,image.naturalHeight*part.height),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;paintActivityInk(canvas,answer,image,part);return canvas.toDataURL('image/png');}
