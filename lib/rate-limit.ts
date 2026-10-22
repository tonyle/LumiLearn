const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((n) => now - n < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now); buckets.set(key, recent); return true;
}
