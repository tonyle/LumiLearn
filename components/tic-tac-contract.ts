import type {TttBoard} from '@/lib/tic-tac-toe';
export type TttState={board:TttBoard;level:number;unlocked:number;round:number;version:number;wins:number;draws:number;losses:number;lastHuman:number|null;lastBot:number|null;message:string;outcome:{winner:'X'|'O'|null;draw:boolean;line:number[]}};
export type TttView=TttState&{runId:string;expiresAt:string;serverNow:string;ended:boolean};
export type TttAction={type:'move';cell:number}|{type:'next'|'switch';level:number};
