import Link from 'next/link';
import {secondaryValue, type SecondaryParams} from '@/lib/secondary-pagination';
export function SecondaryFilters({params, dates = false, pageKey = 'page', placeholder = 'Search'}: {params: SecondaryParams; dates?: boolean; pageKey?: string; placeholder?: string}) {
  return <form className="catalog-filters" method="get">{Object.keys(params).filter(key => !['q', 'from', 'to', pageKey].includes(key)).map(key => <input key={key} type="hidden" name={key} value={secondaryValue(params, key)}/>)}<label>Search<input name="q" defaultValue={secondaryValue(params, 'q')} placeholder={placeholder}/></label>{dates && <><label>From<input type="date" name="from" defaultValue={secondaryValue(params, 'from')}/></label><label>Through<input type="date" name="to" defaultValue={secondaryValue(params, 'to')}/></label></>}<button className="button secondary" type="submit">Filter</button></form>;
}
export function SecondaryPagination({params, count, page, pages, pageKey = 'page', label = 'List pages'}: {params: SecondaryParams; count: number; page: number; pages: number; pageKey?: string; label?: string}) {
 const href = (value: number) => {const query = new URLSearchParams(); Object.keys(params).forEach(key => {const v = secondaryValue(params,key); if(v) query.set(key,v);}); query.set(pageKey,String(value)); return `?${query}`;};
 return <nav className="catalog-pagination" aria-label={label}><span>{count} results · Page {page} of {pages}</span><div className="row">{page > 1 && <Link className="button secondary" href={href(page-1)}>← Previous</Link>}{page < pages && <Link className="button secondary" href={href(page+1)}>Next →</Link>}</div></nav>;
}
