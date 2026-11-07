export type AreaBounds={x:number;y:number;width:number;height:number};
export type AreaHandle='move'|'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function adjustActivityArea(area:AreaBounds,handle:AreaHandle,dx:number,dy:number):AreaBounds{
 if(handle==='move')return {...area,x:clamp(area.x+dx,0,1-area.width),y:clamp(area.y+dy,0,1-area.height)};
 let left=area.x,top=area.y,right=area.x+area.width,bottom=area.y+area.height;
 if(handle.includes('w'))left=clamp(left+dx,0,right-.05);
 if(handle.includes('e'))right=clamp(right+dx,left+.05,1);
 if(handle.includes('n'))top=clamp(top+dy,0,bottom-.05);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+.05,1);
 const round=(value:number)=>Math.round(value*1e6)/1e6;
 return{x:round(left),y:round(top),width:Math.max(.05,round(right-left)),height:Math.max(.05,round(bottom-top))};
}
