import { ArrowDownToLine, Check, LoaderCircle, RefreshCw, RotateCw, X } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { usePresence } from './usePresence';
import { updateBusy, updatePercent } from './updates';
import type { AppUpdates } from './useAppUpdates';
export function UpdateCard({updates,compact=false,blocked=false,onDismiss}:{updates:AppUpdates;compact?:boolean;blocked?:boolean;onDismiss?:()=>void}){
  const {t}=useI18n(),s=updates.status,percent=updatePercent(s),busy=updateBusy(s);
  const label=['available','downloading','ready'].includes(s.phase)?t(`update.${s.phase}`,{version:s.version??''}):t(`update.${s.phase}`);
  return <article className={`update-card ${compact?'update-compact':''}`} aria-label={t('Software updates')}>
    <div className="update-heading">{busy?<LoaderCircle size={17} className="update-spin"/>:s.phase==='current'?<Check size={17}/>:<ArrowDownToLine size={17}/>}<strong role="status">{label}</strong>{compact&&onDismiss&&<button className="icon-button" aria-label={t('Dismiss notification')} onClick={onDismiss}><X size={14}/></button>}</div>
    {s.phase==='downloading'&&<><progress aria-label={t('Update download progress')} max={100} value={percent}/><p className="small muted">{percent===undefined?t('Downloading update…'):t('Downloaded {percent}%',{percent})}</p></>}
    {s.phase==='ready'&&<p className="small muted">{t('The update will install automatically the next time you open ChatNote. You can keep working now.')}</p>}
    {s.error&&<p className="update-error" role="alert">{t(s.error)}</p>}
    {!compact&&s.notes&&<details><summary>{t('What is new')}</summary><p className="update-notes">{s.notes}</p></details>}
    <div className="update-actions">{s.phase==='ready'?<button className="primary" disabled={busy||blocked} onClick={()=>void updates.restart()}><RotateCw size={14}/>{t('Restart and update')}</button>:s.phase==='available'?<button disabled={busy} onClick={()=>void updates.download()}><ArrowDownToLine size={14}/>{t('Retry download')}</button>:!compact&&<button disabled={busy||s.phase==='development'} onClick={()=>void updates.check()}><RefreshCw size={14}/>{t('Check for updates')}</button>}</div>
    {!compact&&<p className="small muted">{t('Updates are checked after startup and downloaded in the background. Your conversations and connections stay on this device.')}</p>}
    {blocked&&s.phase==='ready'&&<p className="small muted">{t('update.wait')}</p>}
  </article>;
}
export function UpdateNotice({updates,blocked}:{updates:AppUpdates;blocked:boolean}){
  const [hidden,setHidden]=useState(false),s=updates.status;
  useEffect(()=>setHidden(false),[s.version,s.phase==='ready']);
  const shown=!hidden&&['available','downloading','ready','saving','installing'].includes(s.phase),presence=usePresence(shown,220);
  return presence.rendered?<aside className={`update-notice ${presence.leaving?'leaving':''}`} aria-hidden={presence.leaving}><UpdateCard updates={updates} compact blocked={blocked} onDismiss={()=>setHidden(true)}/></aside>:null;
}
import { useEffect, useState } from 'react';
