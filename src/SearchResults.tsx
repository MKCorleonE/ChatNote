import type { Session } from './types';
import type { SearchHit } from './search';
import { useI18n } from './I18nProvider';
export function SearchResults({result,sessions,onOpen}:{result:{hits:SearchHit[];more:boolean};sessions:Session[];onOpen:(hit:SearchHit)=>void}){
 const {t}=useI18n();
 return <div className="search-results" role="region" aria-label={t('Search results')}><p className="small muted" role="status">{t(result.more?'More matches exist. Refine your search.':result.hits.length?'Search results':'No matching conversations or notes.')}</p>{result.hits.map(hit=>{
  const before=Math.max(0,hit.start-35),after=Math.min(hit.text.length,hit.end+85);
  return <button className="search-result" key={hit.key} onClick={()=>onOpen(hit)}><strong>{sessions.find(s=>s.id===hit.sessionId)?.title}</strong><small>{t(hit.kind==='note'?'Private note':hit.kind==='organized'?'Organized draft':hit.branchId?'Follow-up':'Main conversation')}{hit.archived?' · '+t('Saved question versions'):''}</small><span>{before>0?'…':''}{hit.text.slice(before,hit.start)}<mark>{hit.text.slice(hit.start,hit.end)}</mark>{hit.text.slice(hit.end,after)}{after<hit.text.length?'…':''}</span></button>;
 })}</div>;
}
