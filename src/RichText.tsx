import { memo, useCallback, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import { useI18n } from './I18nProvider';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Branch, Message } from './types';
interface Props {
  message: Message;
  branches: Branch[];
  enabled: boolean;
  activeId?: string | null;
  onOpen: (id: string) => void;
}
// Positions originate in the Markdown source. Only single literal text leaves are selectable in v0.1.
export const RichText = memo(function RichText({
  message,
  branches,
  enabled,
  activeId,
  onOpen
}: Props) {
  const {t,n}=useI18n();
  const relevant = enabled ? branches.filter(b => b.anchor.messageId === message.id && b.anchor.revision === message.revision) : [];
  const text = useCallback((value: string, start: number | undefined): ReactNode => {
    if (start === undefined || message.text.slice(start, start + value.length) !== value) return value;
    const end = start + value.length;
    const ranges = relevant.filter(b => b.anchor.start < end && b.anchor.end > start);
    const points = [...new Set([start, end, ...ranges.flatMap(b => [Math.max(start, b.anchor.start), Math.min(end, b.anchor.end)])])].sort((a, b) => a - b);
    return points.slice(0, -1).map((p, i) => {
      const q = points[i + 1],
        hits = ranges.filter(b => b.anchor.start <= p && b.anchor.end >= q),
        content = value.slice(p - start, q - start);
      return <span key={p} data-source-start={p}>{hits.length ? <mark role="button" tabIndex={0} className={hits.some(b => b.id === activeId) ? 'active' : ''} title={t('annotationPreview',{count:n(hits.length),question:hits[0].messages.find(m=>m.role==='user')?.text ?? t('Open annotation')})} onClick={() => onOpen(hits[0].id)} onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(hits[0].id);
          }
        }}>{content}</mark> : content}</span>;
    });
  }, [message, relevant, activeId, onOpen,t,n]);
  function sourcePlugin() {
    return (tree: any) => {
      function walk(n: any) {
        if (!n.children) return;
        n.children = n.children.map((c: any) => {
          if (c.type === 'text') return {
            type: 'element',
            tagName: 'source-text',
            properties: {
              sourceStart: c.position?.start?.offset
            },
            children: [c]
          };
          walk(c);
          return c;
        });
      }
      walk(tree);
    };
  }
  return <div className="rich-text" data-message-id={message.id} data-revision={message.revision}>
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[sourcePlugin, rehypeKatex]} components={{
      'source-text': ({
        children,
        node
      }: any) => text(String(children ?? ''), node?.properties?.sourceStart),
      a: ({
        href,
        children
      }: any) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
      img: ({
        alt
      }: any) => <span className="muted">{t('imageAlt',{alt:alt || ''})}</span>
    } as any}>{message.text || (message.status === 'streaming' ? t('Thinking…') : '')}</Markdown>
  </div>;
}, (previous, next) => {
  if (previous.message !== next.message || previous.enabled !== next.enabled || previous.onOpen !== next.onOpen) return false;
  if (previous.branches === next.branches && previous.activeId === next.activeId) return true;
  const relevant = (p: Props) => p.branches.filter(b => b.anchor.messageId === p.message.id && b.anchor.revision === p.message.revision);
  const a = relevant(previous),
    b = relevant(next);
  if (a.length !== b.length || a.some((x, i) => x.id !== b[i].id || x.anchor.start !== b[i].anchor.start || x.anchor.end !== b[i].anchor.end)) return false;
  return a.every(x => x.id === previous.activeId === (x.id === next.activeId));
});
