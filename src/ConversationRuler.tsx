import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from './I18nProvider';
import type { Message } from './types';

export function ConversationRuler({messages,scrollRef}:{messages:Message[];scrollRef:RefObject<HTMLDivElement|null>}) {
  const {t,n}=useI18n(),questions=messages.filter(m=>m.role==='user'),[active,setActive]=useState(''),ruler=useRef<HTMLElement>(null);
  const fingerprint=messages.map(m=>`${m.id}:${m.text.length}`).join(',');
  useEffect(()=>{
    // Sibling scroll containers receive their refs after this child commits.
    const el=scrollRef.current;if(!el)return;const questionIds=new Set(questions.map(q=>q.id));let frame=0;
    const measure=()=>{frame=0;const top=el.getBoundingClientRect().top+Math.min(90,el.clientHeight*.2);let id=questions[0]?.id??'';for(const message of el.querySelectorAll<HTMLElement>('[data-message-id]')){if(questionIds.has(message.dataset.messageId??'')&&message.getBoundingClientRect().top<=top)id=message.dataset.messageId!;}setActive(id);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    measure();el.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(el);if(el.firstElementChild)observer?.observe(el.firstElementChild);
    return()=>{cancelAnimationFrame(frame);el.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer?.disconnect();};
  },[fingerprint,scrollRef]);
  useLayoutEffect(()=>{
    const el=ruler.current,target=el?.querySelector<HTMLElement>('button.active');if(!el||!target)return;
    if(target.offsetTop<el.scrollTop)el.scrollTop=target.offsetTop;
    else if(target.offsetTop+target.offsetHeight>el.scrollTop+el.clientHeight)el.scrollTop=target.offsetTop+target.offsetHeight-el.clientHeight;
  },[active]);
  if(questions.length<2)return null;
  return <nav ref={ruler} className="conversation-ruler" aria-label={t('Conversation rounds')}>{questions.map((q,i)=><button type="button" key={q.id} className={active===q.id?'active':''} aria-current={active===q.id?'step':undefined} aria-label={`${t('Round')} ${n(i+1)} · ${q.text.slice(0,80)}`} title={`${n(i+1)} · ${q.text.slice(0,100)}`} onClick={()=>{const el=scrollRef.current,target=[...el?.querySelectorAll<HTMLElement>('[data-message-id]')??[]].find(node=>node.dataset.messageId===q.id);if(el&&target){el.scrollTo({top:el.scrollTop+target.getBoundingClientRect().top-el.getBoundingClientRect().top-25,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setActive(q.id);}}}><span/></button>)}</nav>;
}
