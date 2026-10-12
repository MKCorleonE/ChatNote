import { useLayoutEffect, useState, type RefObject } from 'react';
import { useI18n } from './I18nProvider';
import type { Message } from './types';

export function ConversationRuler({messages,scrollRef}:{messages:Message[];scrollRef:RefObject<HTMLDivElement|null>}) {
  const {t,n}=useI18n(),questions=messages.filter(m=>m.role==='user'),[active,setActive]=useState('');
  const fingerprint=messages.map(m=>`${m.id}:${m.text.length}`).join(',');
  useLayoutEffect(()=>{
    const el=scrollRef.current;if(!el)return;let frame=0;
    const measure=()=>{frame=0;const top=el.getBoundingClientRect().top+Math.min(90,el.clientHeight*.2);let id=questions[0]?.id??'';for(const message of el.querySelectorAll<HTMLElement>('[data-message-id]')){if(questions.some(q=>q.id===message.dataset.messageId)&&message.getBoundingClientRect().top<=top)id=message.dataset.messageId!;}setActive(id);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    measure();el.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(el);if(el.firstElementChild)observer?.observe(el.firstElementChild);
    return()=>{cancelAnimationFrame(frame);el.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer?.disconnect();};
  },[fingerprint,scrollRef]);
  if(questions.length<2)return null;
  return <nav className="conversation-ruler" aria-label={t('Conversation rounds')}>{questions.map((q,i)=><button type="button" key={q.id} className={active===q.id?'active':''} aria-current={active===q.id?'step':undefined} aria-label={`${t('Round')} ${n(i+1)} · ${q.text.slice(0,80)}`} title={`${n(i+1)} · ${q.text.slice(0,100)}`} onClick={()=>{const el=scrollRef.current,target=[...el?.querySelectorAll<HTMLElement>('[data-message-id]')??[]].find(node=>node.dataset.messageId===q.id);if(el&&target){el.scrollTo({top:el.scrollTop+target.getBoundingClientRect().top-el.getBoundingClientRect().top-25,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setActive(q.id);}}}><span/></button>)}</nav>;
}
