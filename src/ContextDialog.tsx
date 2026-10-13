import { useState } from 'react';
import { Check, Eye, Shield, X } from 'lucide-react';
import { selectContext } from './core';
import { useI18n } from './I18nProvider';
import { useDialogFocus } from './useDialogFocus';
import { AttachmentList } from './AttachmentControls';
import type { ContextReport } from './types';

export function ContextDialog({report,preview,instructions,capabilityError,canSend,onChange,onSend,onClose,onNotice}:{report:ContextReport;preview:boolean;instructions:string;capabilityError?:string|null;canSend:boolean;onChange:(report:ContextReport)=>void;onSend:()=>void;onClose:()=>void;onNotice:(text:string)=>void}) {
  const {t,n}=useI18n(),focus=useDialogFocus(onClose),[error,setError]=useState('');
  const candidates=report.candidates??report.items,selected=report.selected??candidates.map((_,i)=>i),required=report.required??[];
  function choose(indices:number[]) {try{onChange(selectContext(report,indices));setError('');}catch(e){setError(t(e instanceof Error?e.message:String(e)));}}
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section {...focus} className="modal context-modal context-review" role="dialog" aria-modal="true" aria-label={t('Context details')}>
    <header><div><span className="eyebrow">{t(preview?'BEFORE SENDING':'WHAT THE MODEL RECEIVED')}</span><h2><Eye size={21}/>{t('Context details')}</h2></div><button autoFocus className="icon-button" aria-label={t('Close context')} onClick={onClose}><X size={18}/></button></header>
    <div className="context-stats"><span><Shield size={15}/>{t(report.source)}</span><strong>{t('contextSize',{count:n(report.characters),budget:n(report.budget)})}</strong></div>
    <p className="small muted">{t('Context budget limits text carried in this request, not your saved history or the answer length. Image and document tokens are counted by the provider.')}</p>
    {preview&&<><p>{t('Choose the history for this request. The exact passage and current question stay included. Other branches and private notes are excluded.')}</p><div className="context-selection-actions"><button className="text-button" onClick={()=>choose(candidates.map((_,i)=>i))}>{t('Include all history')}</button><button className="text-button" onClick={()=>choose(required)}>{t(report.sourceCount?'Only passage and current question':'Only current question')}</button><small>{n(selected.length)} / {n(candidates.length)}</small></div>
    <div className="context-candidates">{candidates.map((item,i)=><section className={`context-choice ${selected.includes(i)?'selected':''}`} key={i}><label><input type="checkbox" checked={selected.includes(i)} disabled={required.includes(i)} aria-label={`${t('Include context')} ${i+1}`} onChange={e=>choose(e.target.checked?[...selected,i]:selected.filter(x=>x!==i))}/><span><small>{t(required.includes(i)?i===0&&report.sourceCount?'Exact source passage':'Current question':i<(report.sourceCount??0)?'Source history':'Conversation history')} · {t(item.role==='user'?'You':'Assistant')}</small><strong>{(i===0&&report.sourceCount?(item.content.match(/<source>\n([\s\S]*)\n<\/source>/)?.[1]??item.content):item.content).slice(0,110)}</strong></span>{required.includes(i)&&<Check size={14}/>}</label><details><summary>{t('Expand details')}</summary><pre>{item.content}</pre>{item.attachments?.length&&<AttachmentList items={item.attachments} onNotice={onNotice}/>}</details></section>)}</div></>}
    {capabilityError&&<p className="error" role="alert">{t(capabilityError)}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <section className="context-payload"><h3>{t('Actual request context')}</h3><p className={report.summarized?'notice':'small muted'}>{report.summarized?t('abbreviationNote',{count:n(report.omittedTurns)}):t('No history abbreviation was needed for this request.')}</p><div className="context-list">{report.items.map((item,i)=><details key={i} open={!preview}><summary>{t(item.role==='user'?'You':'Assistant')} · {t('characterCount',{count:n(item.content.length)})}</summary><pre>{item.content}</pre>{item.attachments?.length&&<AttachmentList items={item.attachments} onNotice={onNotice}/>}</details>)}</div><details><summary>{t('Complete instructions')}</summary><pre>{instructions}</pre></details></section>
    {preview&&<footer><button onClick={onClose}>{t('Keep editing')}</button><button className="primary" disabled={!canSend||!!error||!!capabilityError} onClick={onSend}>{t('Send with this context')}</button></footer>}
  </section></div>;
}
