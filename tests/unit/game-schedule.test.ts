import {describe,it,expect} from 'vitest';
import {gameDay,gameDayAllowed,gameScheduleLabel} from '@/lib/game-schedule';
describe('weekly game schedule in Coppell time',()=>{
 it('keeps Friday closed at UTC Saturday until Texas midnight',()=>{expect(gameDayAllowed([6,7],new Date('2026-11-07T05:59:59Z'))).toBe(false);expect(gameDayAllowed([6,7],new Date('2026-11-07T06:00:00Z'))).toBe(true);});
 it('closes Sunday at Texas Monday midnight',()=>{expect(gameDayAllowed([6,7],new Date('2026-11-09T05:59:59Z'))).toBe(true);expect(gameDayAllowed([6,7],new Date('2026-11-09T06:00:00Z'))).toBe(false);});
 it('handles daylight saving and empty schedules',()=>{expect(gameDay(new Date('2026-07-06T04:59:59Z'))).toBe(7);expect(gameDay(new Date('2026-07-06T05:00:00Z'))).toBe(1);expect(gameDayAllowed([],new Date())).toBe(false);});
 it('shows ordered selected days and clear all-day/no-day labels',()=>{expect(gameScheduleLabel([7,6])).toBe('Sat, Sun');expect(gameScheduleLabel([])).toBe('No play days');expect(gameScheduleLabel([1,2,3,4,5,6,7])).toBe('Every day');});
});
