import { useState } from 'react';
import { ArrowDownToLine, LoaderCircle, Network, X } from 'lucide-react';
import { MindMap } from './MindMap';
import { buildMindMap } from './mind-map';
import { useI18n } from './I18nProvider';
import { useDialogFocus } from './useDialogFocus';
import type { Session } from './types';
import * as bridge from './bridge';
export function MindMapDialog({session,onClose,onNotice}:{session:Session;onClose:()=>void;onNotice:(text:string)=>void}) {
  const {t,language}=useI18n(),[busy,setBusy]=useState(false),[error,setError]=useState(''),focus=useDialogFocus(onClose,()=>busy);
  async function save(){setBusy(true);setError('');try{const name=session.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,90)||'ChatNote';if(await bridge.saveFile(`${name}-mind-map.html`,buildMindMap(session,language)))onNotice(t('Mind map saved. Open the HTML file on a computer or phone.'));}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section {...focus} className="modal tree-overview mind-map-dialog" role="dialog" aria-modal="true" aria-label={t('Mind map')}><header><h2><Network size={21}/>{t('Mind map')}</h2><button autoFocus className="icon-button" disabled={busy} aria-label={t('Close mind map')} onClick={onClose}><X size={18}/></button></header><p className="map-help small muted">{t('Scroll sideways to follow the branches. Tap a card to expand its evidence.')}</p><MindMap session={session}/>{error&&<p className="error" role="alert">{error}</p>}<footer><span className="small muted">{t('Generated locally from the saved main conversation and follow-ups.')}</span><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?<LoaderCircle size={15} className="spin"/>:<ArrowDownToLine size={15}/>} {t('Export mind map HTML')}</button></footer></section></div>;
}
