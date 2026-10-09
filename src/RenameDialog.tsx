import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from './I18nProvider';

export function RenameDialog({title,onCancel,onSave}:{title:string;onCancel:()=>void;onSave:(title:string)=>void}) {
  const {t}=useI18n(),[value,setValue]=useState(title),input=useRef<HTMLInputElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;input.current?.focus();input.current?.select();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  return <div className="modal-backdrop rename-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel();}}><form className="modal rename-modal" role="dialog" aria-modal="true" aria-label={t('Rename conversation')} onSubmit={e=>{e.preventDefault();if(value.trim())onSave(value.trim());}} onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();onCancel();}
    if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}><header><h2>{t('Rename conversation')}</h2><button type="button" className="icon-button" aria-label={t('Cancel')} onClick={onCancel}><X size={17}/></button></header><div className="rename-body"><label htmlFor="conversation-name">{t('Conversation name')}</label><input id="conversation-name" ref={input} value={value} onChange={e=>setValue(e.target.value)}/></div><footer><button type="button" onClick={onCancel}>{t('Cancel')}</button><button className="primary" type="submit" disabled={!value.trim()}>{t('Save name')}</button></footer></form></div>;
}
