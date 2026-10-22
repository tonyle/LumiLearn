import {describe,it,expect} from 'vitest';import {clockSnapshot,formatStudyTime,type ClockRow} from '@/lib/study-clock';import {tenQuestionLessons} from '@/lib/lesson-batches';
const row:ClockRow={state:'running',elapsed_ms:12000,started_at:new Date(0),running_since:new Date(10000),lease_until:new Date(55000)};
describe('study timing',()=>{
 it('adds active time and freezes when paused or submitted',()=>{expect(clockSnapshot(row,15000).elapsedMs).toBe(17000);for(const state of ['paused','submitted'] as const)expect(clockSnapshot({...row,state},200000).elapsedMs).toBe(12000);});
 it('caps disconnected time at the heartbeat lease and requires resume',()=>{expect(clockSnapshot(row,100000)).toMatchObject({state:'paused',elapsedMs:57000});});
 it('formats minutes and hours without rounding up',()=>{expect(formatStudyTime(59999)).toBe('00:59');expect(formatStudyTime(754000)).toBe('12:34');expect(formatStudyTime(3600000)).toBe('1:00:00');});
});
describe('ten question lessons',()=>{
 it('keeps every question and fills short lessons with distinct grade-matched practice',()=>{const ids=Array.from({length:12},(_,i)=>String(i));const lessons=tenQuestionLessons(ids);expect(lessons).toHaveLength(2);for(const lesson of lessons){expect(lesson).toHaveLength(10);expect(new Set(lesson).size).toBe(10);}expect(lessons[1].slice(0,2)).toEqual(['10','11']);expect(new Set(lessons.flat()).size).toBe(12);});
 it('pads an older two-question worksheet from the supplied pool',()=>{expect(tenQuestionLessons(['a','b'],['c','d','e','f','g','h','i','j'])[0]).toHaveLength(10);});
 it('refuses to fabricate or duplicate questions when the pool is too small',()=>{expect(()=>tenQuestionLessons(['a'])).toThrow();});
});
