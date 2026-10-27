export type SecondaryParams = Record<string, string | string[] | undefined>;
export const secondarySize = 12;
export function secondaryValue(params: SecondaryParams, key: string) {
  const value = params[key];
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}
export function secondaryDate(params: SecondaryParams, key: string) {
  const value = secondaryValue(params, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : '';
}
export function secondaryPage(params: SecondaryParams, count: number, key = 'page') {
  const pages = Math.max(1, Math.ceil(count / secondarySize));
  const requested = Number(secondaryValue(params, key));
  const page = Number.isFinite(requested) ? Math.min(pages, Math.max(1, Math.floor(requested))) : 1;
  return {page, pages, offset: (page - 1) * secondarySize};
}
