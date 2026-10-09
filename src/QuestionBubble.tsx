import { useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { MessageTime } from './MessageTime';
import type { Message } from './types';

export function QuestionBubble({ message, now, editing, draft, disabled, version, count, onCopy, onEdit, onDraft, onCancel, onGenerate, onVersion }: {
  message: Message; now: number; editing: boolean; draft: string; disabled: boolean; version: number; count: number;
  onCopy: () => void; onEdit: () => void; onDraft: (text: string) => void; onCancel: () => void; onGenerate: () => void; onVersion: (index: number) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  useLayoutEffect(() => { if (input.current) { input.current.style.height = 'auto'; input.current.style.height = `${Math.max(64, Math.min(280, input.current.scrollHeight))}px`; } }, [draft, editing]);
  return <>
    {editing ? <div className="question-editor"><textarea ref={input} aria-label={t('Question text')} value={draft} onChange={e => onDraft(e.target.value)} disabled={disabled} onKeyDown={e => {
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (draft.trim() && !disabled) onGenerate(); }
    }} /><div className="question-edit-actions"><button disabled={disabled} onClick={onCancel}>{t('Cancel editing')}</button><button className="primary" disabled={disabled || !draft.trim()} onClick={onGenerate}>{t('Save & regenerate')}</button></div></div> : <p className="user-text question-bubble">{message.text}</p>}
    <div className="message-actions question-actions">
      <button className="icon-button" aria-label={t('Copy question')} title={t('Copy question')} onClick={onCopy}><Copy size={15} /></button>
      <button className="icon-button" aria-label={t('Edit question')} title={t('Edit question')} disabled={disabled || editing} onClick={onEdit}><Pencil size={15} /></button>
      {count > 1 && <span className="question-versions"><button className="icon-button" aria-label={t('Previous question version')} title={t('Previous question version')} disabled={disabled || editing || version === 0} onClick={() => onVersion(version - 1)}><ChevronLeft size={14} /></button><span aria-live="polite">{t('questionVersion', { current: String(version + 1), total: String(count) })}</span><button className="icon-button" aria-label={t('Next question version')} title={t('Next question version')} disabled={disabled || editing || version === count - 1} onClick={() => onVersion(version + 1)}><ChevronRight size={14} /></button></span>}
      <MessageTime timestamp={message.createdAt} now={now}/>
    </div>
  </>;
}
