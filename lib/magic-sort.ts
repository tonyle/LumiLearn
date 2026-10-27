export type MagicBoard=number[][];
export type MagicMove={from:number;to:number};
export const MAGIC_CHAPTERS=['First spark','Colour garden','Bubble brook','Crystal grove','Little alchemist'] as const;
export function magicLevel(level:number){
 if(!Number.isInteger(level)||level<1||level>20)throw Error('Choose a level from 1 to 20.');
 const chapter=Math.floor((level-1)/4),step=(level-1)%4;
 return {level,chapter,name:MAGIC_CHAPTERS[chapter],colours:chapter===0?2:chapter<3?3:4,capacity:chapter<2?2:chapter<4?3:4,spares:2,depth:[3,5,7,10,13][chapter]+step,seals:chapter<2?2:3};
}
const copy=(board:MagicBoard)=>board.map(b=>[...b]);
export function magicSolved(board:MagicBoard,capacity:number){return board.every(b=>!b.length||b.length===capacity&&b.every(c=>c===b[0]));}
export function completedMagicBottles(board:MagicBoard,capacity:number){return board.filter(b=>b.length===capacity&&b.every(c=>c===b[0])).length;}
export function pourMagic(board:MagicBoard,from:number,to:number,capacity:number):MagicBoard|null{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||!board[from]?.length||!board[to]||board[to].length>=capacity)return null;
 const source=board[from],target=board[to],colour=source.at(-1)!;if(target.length&&target.at(-1)!==colour)return null;
 let amount=0;for(let i=source.length-1;i>=0&&source[i]===colour;i--)amount++;
 amount=Math.min(amount,capacity-target.length);const next=copy(board);next[to].push(...next[from].splice(source.length-amount));return next;
}
const exact=(board:MagicBoard)=>board.map(b=>b.join('')).join('|');
const canonical=(board:MagicBoard)=>board.map(b=>b.join('')).sort().join('|');
export function newMagicBoard(level:number,seed:number){
 const config=magicLevel(level);let random=seed>>>0;const pick=(n:number)=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random%n;};
 let board:MagicBoard=Array.from({length:config.colours},(_,c)=>Array(config.capacity).fill(c));for(let i=0;i<config.spares;i++)board.push([]);
 const seen=new Set([canonical(board)]),solution:MagicMove[]=[];
 for(let step=0;step<config.depth;step++){
  const candidates:{board:MagicBoard;inverse:MagicMove;mix:number}[]=[];
  for(let from=0;from<board.length;from++)for(let to=0;to<board.length;to++){
   if(from===to||!board[from].length||board[to].length>=config.capacity)continue;
   const colour=board[from].at(-1)!;
   for(let amount=1;amount<=Math.min(board[from].length,config.capacity-board[to].length);amount++){
    if(!board[from].slice(-amount).every(c=>c===colour))break;
    const next=copy(board);next[to].push(...next[from].splice(next[from].length-amount));const inverse=pourMagic(next,to,from,config.capacity);
    if(!inverse||exact(inverse)!==exact(board)||seen.has(canonical(next)))continue;
    candidates.push({board:next,inverse:{from:to,to:from},mix:next.filter(b=>new Set(b).size>1).length});
   }
  }
  if(!candidates.length)break;
  // Prefer genuinely mixed bottles; preserve some variation and a known reverse solution.
  const best=Math.max(...candidates.map(c=>c.mix)),pool=candidates.filter(c=>c.mix>=best-(step%3===0?1:0));const chosen=pool[pick(pool.length)];board=chosen.board;solution.unshift(chosen.inverse);seen.add(canonical(board));
 }
 if(magicSolved(board,config.capacity))throw Error('Could not prepare a puzzle.');
 return {board,solution};
}
export function solveMagic(board:MagicBoard,capacity:number,maxVisits=20000):MagicMove[]|null{
 if(magicSolved(board,capacity))return [];
 const queue:{board:MagicBoard;path:MagicMove[]}[]=[{board:copy(board),path:[]}],seen=new Set([canonical(board)]);let cursor=0;
 while(cursor<queue.length&&cursor<maxVisits){const current=queue[cursor++];for(let from=0;from<board.length;from++)for(let to=0;to<board.length;to++){
  const next=pourMagic(current.board,from,to,capacity);if(!next)continue;const key=canonical(next);if(seen.has(key))continue;const path=[...current.path,{from,to}];if(magicSolved(next,capacity))return path;seen.add(key);queue.push({board:next,path});
 }}return null;
}
