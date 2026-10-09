import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { activeMessages } from './message-history';
import type { Branch, Message, Session } from './types';
import { PassagePreview } from './PassagePreview';
import type { CSSProperties } from 'react';
export function FollowUpTree({session,onOpen,onCollapsed}:{session:Session;onOpen:(branchId:string,messageId?:string)=>void;onCollapsed:(ids:string[])=>void}){
  const {t,plural,n}=useI18n();
  const toggle=(key:string)=>onCollapsed(session.view.collapsed.includes(key)?session.view.collapsed.filter(id=>id!==key):[...session.view.collapsed,key]);
  function disclosure(key:string,label:string){const closed=session.view.collapsed.includes(key);return <button className="tree-toggle icon-button" aria-label={t(closed?'Expand question':'Collapse question')+` · ${label}`} aria-expanded={!closed} onClick={()=>toggle(key)}>{closed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button>;}
  function node(b:Branch,depth:number){
    const messages=activeMessages(b),children=session.branches.filter(c=>c.parentId===b.id),closed=session.view.collapsed.includes(b.id);
    const turns:{question:Message;answers:Message[]}[]=[];const loose:Message[]=[];
    for(const m of messages){if(m.role==='user')turns.push({question:m,answers:[]});else if(turns.length)turns.at(-1)!.answers.push(m);else loose.push(m);}
    const activeIds=new Set(messages.map(m=>m.id));const archived=children.filter(c=>!activeIds.has(c.anchor.messageId));
    function answer(m:Message){const nested=children.filter(c=>c.anchor.messageId===m.id);return <li className="tree-answer-node" key={m.id}><button className="tree-answer" onClick={()=>onOpen(b.id,m.id)} aria-label={t('Open answer')+` · ${m.text.slice(0,60)||t('status.'+m.status)}`}><span>{m.text.replace(/\s+/g,' ').slice(0,180)||t('status.'+m.status)}</span>{m.status!=='complete'&&m.text&&<small>{t('status.'+m.status)}</small>}</button>{nested.length>0&&<ul className="tree-nested">{nested.map(c=>node(c,depth+1))}</ul>}</li>;}
    return <li className="tree-node" key={b.id} style={{'--depth':Math.min(depth,8)} as CSSProperties}><div className="tree-row">
      <button className="tree-toggle icon-button" aria-label={t(closed?'Expand annotation':'Collapse annotation')+` · ${b.anchor.quote.slice(0,45)}`} aria-expanded={!closed} onClick={()=>toggle(b.id)}>{closed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button>
      <button className="tree-open" onClick={()=>onOpen(b.id)}><div className="tree-source"><PassagePreview text={b.anchor.quote} compact/></div><small>{plural('turnCount',turns.length)}{b.note?` · ${t('Private note')}`:''}</small></button></div>
      {!closed&&<ul className="tree-turns">{turns.map(({question,answers},i)=>{const key=`turn:${b.id}:${question.id}`,folded=session.view.collapsed.includes(key);return <li key={question.id} className="tree-turn"><div className="tree-row">{disclosure(key,question.text.slice(0,45))}<button className="tree-question" onClick={()=>onOpen(b.id,question.id)}><small>{t('Question')} {n(i+1)}</small><span>{question.text}</span></button></div>{!folded&&<ul className="tree-answers">{answers.map(answer)}{!answers.length&&<li className="tree-no-answer">{t('No answer yet')}</li>}</ul>}</li>;})}{loose.map(answer)}{!turns.length&&!loose.length&&b.note&&<li className="tree-note">{b.note.slice(0,150)}</li>}{archived.length>0&&<li className="tree-archived"><span className="small muted">{t('Annotations from saved answer versions')}</span><ul>{archived.map(c=>node(c,depth+1))}</ul></li>}</ul>}
    </li>;
  }
  return <nav className="follow-up-tree" aria-label={t('Follow-up tree')}><div className="tree-root"><MessageSquare size={15}/>{session.title}</div><ul>{session.branches.filter(b=>b.parentId===null).map(b=>node(b,0))}</ul></nav>;
}
