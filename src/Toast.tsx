import { useRef } from 'react';
import { X } from 'lucide-react';
import { usePresence } from './usePresence';
import { useI18n } from './I18nProvider';
export function Toast({text,version,onClose}:{text:string;version:number;onClose:()=>void}) {
  const presence=usePresence(!!text,220),last=useRef(text),{t}=useI18n();if(text)last.current=text;
  return presence.rendered?<div key={version} className={`toast ${presence.leaving?'leaving':''}`} role={presence.leaving?undefined:'status'} aria-hidden={presence.leaving}><span>{last.current}</span><button aria-label={t('Dismiss notification')} onClick={onClose}><X size={14}/></button></div>:null;
}
