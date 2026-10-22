import type { MergeSource, Message } from './types';
import { useI18n } from './I18nProvider';
import { GitMerge } from 'lucide-react';
export function MergeMaterial({message,onSource}:{message:Message;onSource:(source:MergeSource)=>void}) {
  const {t,n}=useI18n();
  return <section className="merge-material"><h3><GitMerge size={15}/>{t('Merged discussion material')}</h3><p className="small muted">{t('Saved snapshot · {count} sources',{count:n(message.merge!.sources.length)})}</p><div className="merge-source-links">{message.merge!.sources.map((source,i)=><button key={i} onClick={()=>onSource(source)} title={source.title}>{t('Merge source')} · {source.title.slice(0,90)}</button>)}</div><details><summary>{t('Review merged material')}</summary><pre>{message.text}</pre></details></section>;
}
