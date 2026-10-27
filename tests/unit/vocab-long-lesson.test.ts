import {it,expect,vi} from 'vitest';import {vocabAnswerSchema,vocabRunView} from '@/lib/vocab-store';
vi.mock('@/lib/db',()=>({sql:vi.fn()}));
it('accepts the last activity in a fifty-word lesson and rejects an out-of-range cursor',()=>{const answer={cursor:249,response:'cat',key:'00000000-0000-4000-8000-000000000001'};expect(vocabAnswerSchema.safeParse(answer).success).toBe(true);expect(vocabAnswerSchema.safeParse({...answer,cursor:250}).success).toBe(false);});
it('reports fifteen reward points for a completed fifty-word snapshot',()=>{const snapshot=Array.from({length:50},(_,i)=>({id:String(i),word:'cat'}));const view=vocabRunView({id:'run',snapshot,tasks:snapshot.map(w=>({wordId:w.id,mode:'picture'})),cursor:50});expect(view.rewardPoints).toBe(15);});
