import { useMemo, useState } from 'react';
import { GitMerge, X } from 'lucide-react';
import { activeMessages } from './message-history';
import { planMerge, type MergePlan } from './branch-merge';
import { useI18n } from './I18nProvider';
import { useDialogFocus } from './useDialogFocus';
import type { Session } from './types';

export function MergeDialog({session,initial=[],blocked=false,onClose,onCommit}:{session:Session;initial?:string[];blocked?:boolean;onClose:()=>void;onCommit:(plan:MergePlan,ids:string[])=>void}) {
  const {t,language,n}=useI18n(), [ids,setIds]=useState(initial),[mode,setMode]=useState<'append'|'new'>('append'),focus=useDialogFocus(onClose);
  const preview=useMemo(()=>{try{return {plan:planMerge(session,ids,mode,language),error:''};}catch(error){return {plan:null,error:t(String(error instanceof Error?error.message:error))};}},[session,ids,mode,language,t]);
  return <div className="modal-backdrop merge-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section {...focus} className="modal merge-dialog" role="dialog" aria-modal="true" aria-label={t('Merge discussions')}>
    <header><h2><GitMerge size={20}/>{t('Merge discussions')}</h2><button className="icon-button" aria-label={t('Close merge')} onClick={onClose}><X size={18}/></button></header>
    <p className="muted">{t('Bring your follow-up research back to the main conversation. Original discussions and their sources stay saved.')}</p>
    <div className="merge-modes" role="group" aria-label={t('Merge destination')}>{(['append','new'] as const).map(value=><button key={value} aria-pressed={mode===value} className={mode===value?'active':''} onClick={()=>setMode(value)}>{t(value==='append'?'Bring back to main':'Create a merged conversation')}</button>)}</div>
    <div className="merge-body"><fieldset className="merge-sources"><legend>{t('Choose follow-ups')}</legend>{session.branches.map(branch=><label key={branch.id}><input type="checkbox" checked={ids.includes(branch.id)} disabled={blocked||branch.messages.some(m=>m.status==='streaming')} onChange={e=>setIds(old=>e.target.checked?[...old,branch.id]:old.filter(id=>id!==branch.id))}/><span><strong>{activeMessages(branch).find(m=>m.role==='user')?.text||t('Annotation')}</strong><small>{branch.anchor.quote}</small></span></label>)}</fieldset>
    <section className="merge-preview"><h3>{t('Material preview')}</h3>{preview.plan?.content?<pre>{preview.plan.content}</pre>:<p className="muted" role="status">{preview.error||t('These follow-ups have no new content to bring back.')}</p>}</section></div>
    <p className="small muted">{t('Merging saves a snapshot locally. It does not call a model. Send your next question when ready.')}</p>
    <footer><span className="small muted">{t('characterCount',{count:n(preview.plan?.characters??0)})}</span><button className="primary" disabled={blocked||!preview.plan?.sources.length} onClick={()=>preview.plan&&onCommit(preview.plan,ids)}><GitMerge size={15}/>{t(mode==='append'?'Bring back to main':'Create a merged conversation')}</button></footer>
  </section></div>;
}
