import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { useI18n } from './I18nProvider';
export function DeleteDialog({title,description,detail,recoverable=false,onCancel,onDelete}:{title:string;description:string;detail?:string;recoverable?:boolean;onCancel:()=>void;onDelete:()=>void}){
  const {t}=useI18n();const root=useRef<HTMLElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;root.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();return()=>{if(previous?.isConnected)previous.focus();else document.querySelector<HTMLButtonElement>('.rail-new')?.focus();};},[]);
  return createPortal(<div className="modal-backdrop delete-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel();}}><section ref={root} className="modal delete-modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
    if(e.key==='Escape'){e.stopPropagation();onCancel();}
    if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}><header><h2><Trash2 size={18}/>{title}</h2><button className="icon-button" onClick={onCancel} aria-label={t('Cancel deletion')}><X size={17}/></button></header><div className="delete-body"><p>{description}</p>{detail&&<p className="delete-impact">{detail}</p>}<p className="small muted">{t(recoverable?'This conversation can be restored from the recycle bin for 24 hours. Expired items are removed on the next app launch.':'This deletion cannot be undone. Export a backup first if needed.')}</p></div><footer><button data-cancel onClick={onCancel}>{t('Cancel')}</button><button className="danger-button" onClick={onDelete}>{t('Delete')}</button></footer></section></div>,document.body);
}
