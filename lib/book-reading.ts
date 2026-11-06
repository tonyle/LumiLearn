export type ReadingWord = { text: string; status: 'matched' | 'retry' | 'missing' };
export type ReadingComparison = { words: ReadingWord[]; extra: string[]; matches: number; total: number };

const MAX_WORDS = 200;
function tokens(text: string) {
  return (text.match(/\S+/g) ?? []).map(text => ({
    text,
    normalized: text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '').replace(/'/g, ''),
  })).filter(word => word.normalized).slice(0, MAX_WORDS);
}

/** Compares transcript words, not pronunciation. Inputs are bounded to keep alignment work small. */
export function compareReading(expected: string, heard: string): ReadingComparison {
  const a = tokens(expected), b = tokens(heard);
  const cost = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) cost[i][0] = i;
  for (let j = 0; j <= b.length; j++) cost[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1,
      cost[i - 1][j - 1] + Number(a[i - 1].normalized !== b[j - 1].normalized));
  }
  const words: ReadingWord[] = a.map(word => ({ text: word.text, status: 'missing' }));
  const extra: string[] = [];
  let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && a[i - 1].normalized === b[j - 1].normalized && cost[i][j] === cost[i - 1][j - 1]) {
      words[--i].status = 'matched'; j--;
    } else if (i && j && cost[i][j] === cost[i - 1][j - 1] + 1) {
      words[--i].status = 'retry'; j--;
    } else if (i && cost[i][j] === cost[i - 1][j] + 1) {
      i--;
    } else {
      extra.push(b[--j].text);
    }
  }
  return { words, extra: extra.reverse(), matches: words.filter(word => word.status === 'matched').length, total: words.length };
}
