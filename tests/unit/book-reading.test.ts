import { describe, expect, it } from 'vitest';
import { compareReading } from '@/lib/book-reading';

describe('read-aloud transcript alignment', () => {
  it('ignores case and punctuation while preserving the printed words', () => {
    expect(compareReading('“Hello,” I can’t go!', 'hello i cant go').words).toEqual([
      { text: '“Hello,”', status: 'matched' }, { text: 'I', status: 'matched' },
      { text: 'can’t', status: 'matched' }, { text: 'go!', status: 'matched' },
    ]);
  });
  it('marks a missing middle word without shifting later matches', () => {
    expect(compareReading('The little cat sat.', 'the cat sat').words.map(w => w.status)).toEqual(['matched', 'missing', 'matched', 'matched']);
  });
  it('marks a substituted word for retry', () => {
    expect(compareReading('The cat sat', 'the dog sat').words.map(w => w.status)).toEqual(['matched', 'retry', 'matched']);
  });
  it('reports extra and repeated words in transcript order', () => {
    const result = compareReading('The cat sat', 'well the cat cat sat now');
    expect(result.extra).toEqual(['well', 'cat', 'now']);
    expect(result.matches).toBe(3);
  });
  it('marks every expected word missing for no audio', () => {
    expect(compareReading('One two', '')).toEqual({ words: [{ text: 'One', status: 'missing' }, { text: 'two', status: 'missing' }], extra: [], matches: 0, total: 2 });
    expect(compareReading('', 'hello').extra).toEqual(['hello']);
  });
  it('bounds both token lists to 200 words', () => {
    const result = compareReading('word '.repeat(1000), 'word '.repeat(1000));
    expect(result.total).toBe(200);
    expect(result.matches).toBe(200);
  });
});
