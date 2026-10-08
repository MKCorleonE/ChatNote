import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import type {Message} from './types';
export function AnswerStatus({message}: {message:Message}) {
  const {t,n}=useI18n();const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(message.status!=='streaming')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[message.status]);
  const seconds=Math.max(0,Math.round(((message.completedAt??now)-message.createdAt)/1000));
  return <div className="answer-status" role={message.status==='streaming'?'status':undefined}><span className={message.status==='streaming'?'status-dot':''}/><span>{t(message.status==='streaming'?(message.text?'Generating answer':'Waiting for model'):message.status==='complete'?'Answer complete':message.status==='stopped'?'Generation stopped':'Generation failed')}</span>{(message.status==='streaming'||message.completedAt)&&<span>{t('elapsedSeconds',{count:n(seconds)})}</span>}{message.text&&<span>{t('characterCount',{count:n(message.text.length)})}</span>}</div>;
}
