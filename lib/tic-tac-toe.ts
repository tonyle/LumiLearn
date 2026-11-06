export type TttBoard = Array<'X' | 'O' | null>;
type Mark = 'X' | 'O';
export const TTT_SIZE = 9;
export const TTT_CELLS = TTT_SIZE * TTT_SIZE;
export const TTT_CONNECT = 5;
export const TTT_LEVELS = [
  {level:1,name:'Beginner',description:'Explore the big board with a gentle robot.'},
  {level:2,name:'Explorer',description:'Starts spotting chances to win and defend.'},
  {level:3,name:'Thinker',description:'Spots four-in-a-row wins and threats.'},
  {level:4,name:'Expert',description:'Plans replies and builds stronger lines.'},
  {level:5,name:'Master',description:'Looks further ahead. Find your best strategy!'},
] as const;
// Only generate in-bounds windows: adjacent array rows never wrap into a line.
const LINES:number[][]=[];
for(let r=0;r<TTT_SIZE;r++)for(let c=0;c<TTT_SIZE;c++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
 const endR=r+dr*4,endC=c+dc*4;
 if(endR>=0&&endR<TTT_SIZE&&endC>=0&&endC<TTT_SIZE)LINES.push(Array.from({length:5},(_,i)=>(r+dr*i)*TTT_SIZE+c+dc*i));
}
const CELL_LINES=Array.from({length:TTT_CELLS},(_,i)=>LINES.filter(l=>l.includes(i)));
export function tttOutcome(board:TttBoard):{winner:Mark|null;draw:boolean;line:number[]}{
 if(board.length!==TTT_CELLS)return {winner:null,draw:false,line:[]};
 for(const line of LINES){const m=board[line[0]];if(m&&line.every(i=>board[i]===m))return {winner:m,draw:false,line:[...line]};}
 return {winner:null,draw:board.every(m=>m!==null),line:[]};
}
export function tttMove(board:TttBoard,cell:number,mark:Mark):TttBoard|null{
 if(board.length!==TTT_CELLS||!Number.isInteger(cell)||cell<0||cell>=TTT_CELLS||board[cell]!==null)return null;
 const o=tttOutcome(board);if(o.winner||o.draw)return null;
 const next=[...board];next[cell]=mark;return next;
}
function random(seed:number){let n=(Number.isFinite(seed)?seed:0)|0;n=Math.imul(n^0x9e3779b9,0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;}
const WEIGHTS=[0,2,16,160,12000,1000000];
function potential(b:TttBoard,cell:number,mark:Mark){let total=0;for(const line of CELL_LINES[cell]){let count=1,blocked=false;for(const i of line){if(i===cell)continue;if(b[i]&&b[i]!==mark){blocked=true;break;}if(b[i]===mark)count++;}if(!blocked)total+=WEIGHTS[count];}return total;}
function ranked(b:TttBoard,mark:Mark){const other=mark==='O'?'X':'O';return b.flatMap((v,i)=>v?[]:[{cell:i,score:potential(b,i,mark)+potential(b,i,other)*.95+(8-Math.abs(4-Math.floor(i/9))-Math.abs(4-i%9))*.1}]).sort((a,b)=>b.score-a.score||a.cell-b.cell);}
function evaluate(b:TttBoard,mark:Mark){let value=0;for(const line of LINES){let own=0,opp=0;for(const c of line){if(b[c]===mark)own++;else if(b[c])opp++;}if(!opp)value+=WEIGHTS[own];if(!own)value-=WEIGHTS[opp];}return value;}
// Fixed beam/depth bounds keep each server turn fast even with 81 empty cells.
function search(b:TttBoard,turn:Mark,depth:number,alpha:number,beta:number):number{
 const o=tttOutcome(b);if(o.winner)return o.winner===turn?10000000+depth:-10000000-depth;if(o.draw)return 0;if(!depth)return evaluate(b,turn);
 let best=-Infinity;for(const {cell} of ranked(b,turn).slice(0,6)){b[cell]=turn;const score=-search(b,turn==='O'?'X':'O',depth-1,-beta,-alpha);b[cell]=null;best=Math.max(best,score);alpha=Math.max(alpha,score);if(alpha>=beta)break;}return best;
}
/** Server chooses O; level 5 uses bounded lookahead, not an unbeatable-play claim. */
export function tttBotMove(board:TttBoard,level:number,seed:number):number|null{
 const o=tttOutcome(board);if(board.length!==TTT_CELLS||o.winner||o.draw)return null;
 const moves=ranked(board,'O');if(!moves.length)return null;
 const roll=random(seed),pick=(n:number)=>moves[Math.floor(random(seed+7919)*Math.min(n,moves.length))].cell;
 if(level<=1)return pick(moves.length);
 if(level>=3||roll<.65){for(const mark of ['O','X'] as const){const win=moves.find(({cell})=>CELL_LINES[cell].some(line=>line.every(i=>i===cell||board[i]===mark)));if(win)return win.cell;}}
 if(level===2)return pick(12);
 if(level===3)return pick(roll<.7?1:4);
 let best=-Infinity,choice=moves[0].cell;const b=[...board];for(const {cell} of moves.slice(0,6)){b[cell]='O';const score=-search(b,'X',level>=5?2:1,-Infinity,Infinity);b[cell]=null;if(score>best){best=score;choice=cell;}}return choice;
}
export function tttNextBoard(round:number,level:number,seed:number):TttBoard{const b:TttBoard=Array(TTT_CELLS).fill(null);if(level>=3&&round%2===1){const c=tttBotMove(b,level,seed);if(c!==null)b[c]='O';}return b;}
