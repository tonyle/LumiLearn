/** Pen/mouse-only page dragging. Touch never draws or pans the worksheet. */
export function attachPaperNavigation(sheet:HTMLElement,getTool:()=>string){
 type Target={element:HTMLElement;x:boolean;y:boolean};
 let drag:{id:number;x:number;y:number;targets:Target[]}|null=null;
 function targets(){const rows:Target[]=[];const root=document.scrollingElement??document.documentElement;
  for(let element:HTMLElement|null=sheet.parentElement;element;element=element.parentElement){if(element===root)continue;const style=getComputedStyle(element);const x=/(auto|scroll)/.test(style.overflowX||style.overflow),y=/(auto|scroll)/.test(style.overflowY||style.overflow);if(x||y)rows.push({element,x,y});}
  rows.push({element:root as HTMLElement,x:true,y:true});return rows;
 }
 function stop(event:Event){if(event.cancelable)event.preventDefault();event.stopPropagation();}
 function end(){if(!drag)return;try{if(sheet.hasPointerCapture?.(drag.id))sheet.releasePointerCapture(drag.id);}catch{}drag=null;sheet.classList.remove('is-dragging-paper');}
 function down(event:PointerEvent){if(event.pointerType==='touch'){stop(event);return;}if(getTool()!=='move'||event.button>0)return;end();stop(event);drag={id:event.pointerId,x:event.clientX,y:event.clientY,targets:targets()};try{sheet.setPointerCapture(event.pointerId);}catch{}sheet.classList.add('is-dragging-paper');}
 function move(event:PointerEvent){if(event.pointerType==='touch'){if(sheet.contains(event.target as Node))stop(event);return;}if(!drag||drag.id!==event.pointerId)return;if(getTool()!=='move'){end();return;}stop(event);let dx=drag.x-event.clientX,dy=drag.y-event.clientY;drag.x=event.clientX;drag.y=event.clientY;
  for(const target of drag.targets){const el=target.element;if(target.x&&dx){const before=el.scrollLeft;el.scrollLeft=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,before+dx));dx-=el.scrollLeft-before;}if(target.y&&dy){const before=el.scrollTop;el.scrollTop=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,before+dy));dy-=el.scrollTop-before;}}
 }
 function up(event:PointerEvent){if(event.pointerType==='touch'){if(sheet.contains(event.target as Node))stop(event);return;}if(drag?.id===event.pointerId)end();}
 function touch(event:TouchEvent){stop(event);}
 const capture={capture:true,passive:false};
 sheet.addEventListener('pointerdown',down,capture);window.addEventListener('pointermove',move,capture);window.addEventListener('pointerup',up,capture);window.addEventListener('pointercancel',up,capture);sheet.addEventListener('touchstart',touch,capture);sheet.addEventListener('touchmove',touch,capture);window.addEventListener('blur',end);
 return()=>{end();sheet.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);sheet.removeEventListener('touchstart',touch,true);sheet.removeEventListener('touchmove',touch,true);window.removeEventListener('blur',end);};
}
