import {describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/db',()=>({sql:vi.fn()}));
import {validDay,today} from '@/lib/learning-history';
describe('learning journal dates',()=>{it('accepts calendar dates only',()=>{expect(validDay('2026-10-21')).toBe(true);expect(validDay('2026-02-30')).toBe(false);expect(validDay('2026-1-2')).toBe(false);expect(validDay("2026-01-01' OR true")).toBe(false);});it('uses a date-only day key',()=>{expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);});});
