import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { mapNodes, mapExcerpt, type MapNode } from './mind-map';
import { RichText } from './RichText';
import { message } from './core';
import { useI18n } from './I18nProvider';
import type { Session } from './types';
export function MindMap({ session, onOpen }: { session: Session; onOpen?: (id: string, messageId?: string) => void }) {
  const { t, language } = useI18n(), nodes = useMemo(() => mapNodes(session, language), [session, language]);
  const rich = (text: string) => <RichText message={message('assistant', text)} branches={[]} enabled={false} onOpen={() => {}} />;
  function node(n: MapNode) {
    return <li key={n.id}><div className="map-row"><details className={`map-card ${n.kind}`}><summary><small>{t(n.kind === 'branch' ? 'Follow-up' : 'Main conversation')}</small><strong>{n.title}</strong><span className="map-excerpt">{mapExcerpt(n)}</span><em>{t('Expand details')}</em></summary><div className="map-details">{n.source && <blockquote>{rich(n.source)}</blockquote>}{n.messages.map(m => <article key={m.id}><small>{t(m.role === 'user' ? 'You' : 'Assistant')}{m.status !== 'complete' && ` · ${t('status.' + m.status)}`}</small>{rich(m.text)}</article>)}{n.note && <aside><strong>{t('My understanding')}</strong>{rich(n.note)}</aside>}{n.archived?.length ? <details><summary>{t('Saved question versions')}</summary>{n.archived.flatMap(path => path.map(m => <article key={`${m.id}-${m.revision}`}>{rich(m.text)}</article>))}</details> : null}{onOpen && n.branchId && <button className="text-button" onClick={() => onOpen(n.branchId!, n.messageId)}><ArrowUpRight size={14}/>{t('Open annotation')}</button>}</div></details>{n.children.length > 0 && <ul>{n.children.map(node)}</ul>}</div></li>;
  }
  return <div className="mind-map-scroll"><ul className="mind-map">{nodes.map(node)}</ul>{!nodes.length && <p className="small muted">{t('Your questions will grow here.')}</p>}</div>;
}
