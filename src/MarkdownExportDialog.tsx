import {useState} from 'react';
import {X} from 'lucide-react';
import type {Session} from './types';
import {ExportScopeControls} from './ExportScopeControls';
import {personalExport,scopedSession} from './export-scope';
import {exportMarkdown} from './core';
import {useI18n} from './I18nProvider';
import {useDialogFocus} from './useDialogFocus';
import * as bridge from './bridge';
export function MarkdownExportDialog({session,fileName,onClose,onNotice,onExport}:{session:Session;fileName:string;onClose:()=>void;onNotice:(text:string)=>void;onExport:()=>void}){
 const {t,language}=useI18n(),[scope,setScope]=useState({...personalExport}),[busy,setBusy]=useState(false),[error,setError]=useState(''),focus=useDialogFocus(onClose,()=>busy);
 async function save(){setBusy(true);try{if(await bridge.saveFile(fileName+'.md',exportMarkdown(scopedSession(session,scope),language))){onNotice(t('Conversation exported.'));onExport();onClose();}}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <div className="modal-backdrop"><section {...focus} className="modal" role="dialog" aria-modal="true" aria-label={t('Export this conversation')}><header><h2>{t('Export this conversation')}</h2><button className="icon-button" disabled={busy} aria-label={t('Close export')} onClick={onClose}><X size={18}/></button></header><ExportScopeControls value={scope} onChange={setScope} disabled={busy} attachments={false}/><p className="small muted">{t('Markdown contains text and selected attachment names, not attachment files.')}</p>{error&&<p className="error" role="alert">{error}</p>}<footer><button disabled={busy} className="primary" onClick={()=>void save()}>{t('Export Markdown')}</button></footer></section></div>;
}
