import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './I18nProvider';
import { activeMessages } from './message-history';
import { usePresence } from './usePresence';
import type { Branch } from './types';

// Keep preview text outside the transcript so it never changes selection offsets.
export function AnnotationHint({branches,children}:{branches:Branch[];children:(props:HTMLAttributes<HTMLElement>)=>ReactNode}) {
  const {t,n}=useI18n(),id=useId(),[open,setOpen]=useState(false),[position,setPosition]=useState({left:8,top:8,below:false});
  const trigger=useRef<HTMLElement|null>(null),hint=useRef<HTMLDivElement>(null),hovered=useRef(false),focused=useRef(false),presence=usePresence(open);
  const count=branches.reduce((sum,b)=>sum+activeMessages(b).filter(m=>m.role==='user').length,0);
  const first=[...branches].sort((a,b)=>a.createdAt-b.createdAt).flatMap(b=>b.messages.filter(m=>m.role==='user'))[0]?.text??'';
  const chars=Array.from(first.replace(/\s+/g,' ').trim()),preview=chars.slice(0,18).join('')+(chars.length>18?'…':'');
  const summary=t('followUpPreviewCount',{count:n(count)});
  function locate(el:HTMLElement){const rect=el.getBoundingClientRect(),height=hint.current?.offsetHeight??70,width=Math.min(260,window.innerWidth-16),below=rect.top<height+16;setPosition({left:Math.max(8,Math.min(rect.left+(rect.width-width)/2,window.innerWidth-width-8)),top:below?Math.min(rect.bottom+8,window.innerHeight-height-8):rect.top-8,below});}
  useEffect(()=>{if(!open)return;const dismiss=()=>setOpen(false),reposition=()=>{if(!trigger.current)return;const rect=trigger.current.getBoundingClientRect();if(rect.bottom<0||rect.top>window.innerHeight)dismiss();else locate(trigger.current);};reposition();window.addEventListener('resize',dismiss);document.addEventListener('scroll',reposition,true);return()=>{window.removeEventListener('resize',dismiss);document.removeEventListener('scroll',reposition,true);};},[open]);
  const show=(el:HTMLElement)=>{trigger.current=el;locate(el);setOpen(true);};
  return <>{children({onMouseEnter:e=>{hovered.current=true;show(e.currentTarget);},onMouseLeave:()=>{hovered.current=false;if(!focused.current)setOpen(false);},onFocus:e=>{focused.current=true;show(e.currentTarget);},onBlur:e=>{if(!e.currentTarget.contains(e.relatedTarget)){focused.current=false;if(!hovered.current)setOpen(false);}},onKeyDown:e=>{if(e.key==='Escape')setOpen(false);},'aria-describedby':open?id:undefined})}{presence.rendered&&createPortal(<div className={`annotation-hint-position ${position.below?'below':''}`} style={{left:position.left,top:position.top}}><div ref={hint} id={id} role="tooltip" aria-hidden={presence.leaving} className={`annotation-hint ${presence.leaving?'leaving':''}`}><span>{summary}</span>{preview&&<p>{preview}</p>}</div></div>,document.body)}</>;
}
