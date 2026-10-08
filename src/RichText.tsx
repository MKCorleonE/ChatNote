import { memo, useMemo, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useI18n } from './I18nProvider';
import { normalizeMath } from './source';
import type { Branch, Message } from './types';
interface Props {message:Message;branches:Branch[];enabled:boolean;activeId?:string|null;onOpen:(id:string)=>void;onSelectBlock?:(message:Message,start:number,end:number)=>void}

export const RichText=memo(function RichText({message,branches,enabled,activeId,onOpen,onSelectBlock}:Props){
  const {t,n}=useI18n();const normalized=useMemo(()=>normalizeMath(message.text),[message.text]);
  const relevant=enabled?branches.filter(b=>b.anchor.messageId===message.id&&b.anchor.revision===message.revision):[];
  const offset=(p:number|undefined)=>p===undefined?undefined:normalized.offsets[p];
  function sourcePlugin(){return(tree:any)=>{
    function walk(parent:any){if(!parent.children)return;parent.children=parent.children.map((node:any)=>{
      const classes=node.properties?.className??[];
      if(classes.includes('language-math')||classes.includes('math-inline')||classes.includes('math-display')){
        const start=offset(node.position?.start?.offset??parent.position?.start?.offset),end=offset(node.position?.end?.offset??parent.position?.end?.offset);
        return{type:'element',tagName:'source-formula',properties:{sourceStart:start,sourceEnd:end,display:classes.includes('math-display')},children:[node]};
      }
      if(node.type==='text'){
        let start=offset(node.position?.start?.offset),end=offset(node.position?.end?.offset);
        if(start===undefined&&parent.tagName==='code'){
          const from=offset(parent.position?.start?.offset)??0,to=offset(parent.position?.end?.offset)??message.text.length;
          const value=node.value.replace(/\n$/,'');const at=message.text.indexOf(value,from);
          if(at>=from&&at+value.length<=to){start=at;end=at+value.length;}
        }
        return{type:'element',tagName:'source-text',properties:{sourceStart:start,sourceEnd:end},children:[node]};
      }
      walk(node);return node;
    });}walk(tree);
  };}
  function text(value:string,start:number|undefined,end:number|undefined):ReactNode{
    if(start===undefined||end===undefined)return value;
    const original=message.text.slice(start,end);let map:number[];
    if(original===value||original+'\n'===value)map=Array.from({length:value.length+1},(_,i)=>start+Math.min(i,original.length));
    else{
      // Markdown escaped punctuation renders one character from two source characters.
      map=[start];let i=0,j=0;
      while(i<original.length&&j<value.length){if(original[i]==='\\'&&original[i+1]===value[j])i++;if(original[i]!==value[j])return <span data-source-start={start} data-source-end={end} data-source-atomic="true">{value}</span>;i++;j++;map.push(start+i);}
      if(j!==value.length)return value;
    }
    const points=[...new Set([0,value.length,...relevant.flatMap(b=>map.flatMap((p,i)=>p===b.anchor.start||p===b.anchor.end?[i]:[]))])].sort((a,b)=>a-b);
    return points.slice(0,-1).map((p,i)=>{const q=points[i+1],hits=relevant.filter(b=>b.anchor.start<map[q]&&b.anchor.end>map[p]);const part=value.slice(p,q);
      return <span key={p} data-source-start={map[p]} data-source-end={map[q]} data-source-map={map.slice(p,q+1).join(',')}>{hits.length?<mark role="button" tabIndex={0} className={hits.some(b=>b.id===activeId)?'active':''} title={t('annotationPreview',{count:n(hits.length),question:hits[0].messages.find(m=>m.role==='user')?.text??t('Open annotation')})} onClick={()=>onOpen(hits[0].id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(hits[0].id);}}}>{part}</mark>:part}</span>;
    });
  }
  return <div className="rich-text" data-message-id={message.id} data-revision={message.revision}><Markdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[sourcePlugin,[rehypeKatex,{strict:'ignore',trust:false}]]} components={{
    'source-text':({children,node}:any)=>text(String(children??''),node?.properties?.sourceStart,node?.properties?.sourceEnd),
    'source-formula':({children,node}:any)=>{const start=node?.properties?.sourceStart,end=node?.properties?.sourceEnd;const hits=relevant.filter(b=>start!==undefined&&b.anchor.start<end&&b.anchor.end>start);return <span className={`formula-source ${hits.length?'annotated':''}`} data-source-atomic="true" data-source-start={start} data-source-end={end}>{children}{enabled&&message.status!=='streaming'&&start!==undefined&&<button className="formula-action" aria-label={t('Annotate formula')} onClick={()=>hits.length?onOpen(hits[0].id):onSelectBlock?.(message,start,end)}>{t('Annotate formula')}</button>}</span>;},
    pre:({children,node}:any)=>{if(node?.children?.[0]?.tagName==='source-formula')return <div className="math-block">{children}</div>;const start=offset(node?.position?.start?.offset),end=offset(node?.position?.end?.offset);const code=node?.children?.[0],label=code?.properties?.className?.find((c:string)=>c.startsWith('language-'))?.slice(9)??t('Code');return <div className="code-block"><div className="code-toolbar"><span>{label}</span><div><button onClick={()=>void navigator.clipboard?.writeText(message.text.slice(start??0,end??message.text.length).replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/,'').replace(/\n {0,3}(`{3,}|~{3,})\s*$/,''))}>{t('Copy code')}</button>{enabled&&message.status!=='streaming'&&start!==undefined&&<button onClick={()=>onSelectBlock?.(message,start,end!)}>{t('Annotate code')}</button>}</div></div><pre>{children}</pre></div>;},
    a:({href,children}:any)=><a href={href} target="_blank" rel="noreferrer">{children}</a>,
    img:({alt}:any)=><span className="muted">{t('imageAlt',{alt:alt||''})}</span>
  } as any}>{normalized.text}</Markdown></div>;
});
