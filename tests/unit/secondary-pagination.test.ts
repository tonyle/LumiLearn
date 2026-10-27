import {describe, expect, it} from 'vitest';
import {secondaryDate, secondaryPage, secondaryValue} from '../../lib/secondary-pagination';
describe('secondary list pagination', () => {
  it('clamps invalid, fractional and out-of-range pages', () => {
    expect(secondaryPage({page:'Infinity'},40).page).toBe(1);
    expect(secondaryPage({page:'2.8'},40).offset).toBe(12);
    expect(secondaryPage({page:'999'},40).page).toBe(4);
    expect(secondaryPage({page:'-4'},0)).toEqual({page:1,pages:1,offset:0});
  });
  it('uses a separate learner page parameter', () => {
    expect(secondaryPage({page:'4',learnersPage:'2'},40,'learnersPage').page).toBe(2);
  });
  it('accepts actual dates and ignores malformed inputs', () => {
    expect(secondaryDate({from:'2026-02-28'},'from')).toBe('2026-02-28');
    expect(secondaryDate({from:'2026-02-30'},'from')).toBe('');
    expect(secondaryValue({q:['one','two']},'q')).toBe('');
  });
});
