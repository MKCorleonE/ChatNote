import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Image, LoaderCircle, X } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { useDialogFocus } from './useDialogFocus';
import type { Attachment } from './types';
import * as bridge from './bridge';

export function AttachmentImage({attachment,onNotice}:{attachment:Attachment;onNotice:(text:string)=>void}) {
  const {t}=useI18n(),[source,setSource]=useState(''),[error,setError]=useState(''),[open,setOpen]=useState(false),[visible,setVisible]=useState(false),button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!globalThis.IntersectionObserver){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'160px'});
    if(button.current)observer.observe(button.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible&&!open)return;let live=true;
    bridge.readAttachment(attachment.id).then(record=>{if(live)setSource(`data:${attachment.mime};base64,${record.data}`);}).catch(()=>{if(live)setError(t('The local image could not be loaded. Attach the original image again.'));});
    return()=>{live=false;};
  },[attachment.id,attachment.mime,visible,t]);
  return <><button ref={button} type="button" className="attachment-thumbnail" title={t('Preview image')} aria-label={`${t('Preview image')} · ${attachment.name}`} onClick={()=>{setVisible(true);setOpen(true);}}>{source?<img src={source} alt={attachment.name} loading="lazy"/>:error?<Image size={22}/>:<LoaderCircle size={18} className="spin"/>}</button>{open&&createPortal(<ImagePreview attachment={attachment} source={source} error={error} onClose={()=>setOpen(false)} onNotice={onNotice}/>,document.body)}</>;
}
function ImagePreview({attachment,source,error,onClose,onNotice}:{attachment:Attachment;source:string;error:string;onClose:()=>void;onNotice:(text:string)=>void}) {
  const {t}=useI18n(),focus=useDialogFocus(onClose);
  return <div className="modal-backdrop image-preview-backdrop" onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose();}}><section ref={focus.ref} onKeyDown={e=>{focus.onKeyDown(e);e.stopPropagation();}} className="modal image-preview-dialog" role="dialog" aria-modal="true" aria-label={t('Image preview')}><header><h2>{attachment.name}</h2><button autoFocus className="icon-button" aria-label={t('Close image preview')} onClick={onClose}><X size={18}/></button></header><div className="image-preview-surface">{source?<img src={source} alt={attachment.name}/>:error?<p role="alert" className="error">{error}</p>:<LoaderCircle size={24} className="spin"/>}</div><footer><button disabled={!source} onClick={()=>void bridge.downloadAttachment(attachment).catch(e=>onNotice(String(e)))}><Download size={16}/>{t('Save attachment')}</button></footer></section></div>;
}
