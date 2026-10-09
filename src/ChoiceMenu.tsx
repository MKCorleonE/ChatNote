import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { usePresence } from './usePresence';
export function ChoiceMenu({label,value,options,disabled,title,onChange,placement='above'}:{label:string;value:string;options:{value:string;label:string}[];disabled?:boolean;title?:string;onChange:(value:string)=>void;placement?:'above'|'below'}){
  const [open,setOpen]=useState(false),[active,setActive]=useState(0);const presence=usePresence(open);
  const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null);
  const chosen=options.find(o=>o.value===value);
  function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
  useEffect(()=>{if(!open)return;setActive(Math.max(0,options.findIndex(o=>o.value===value)));list.current?.focus();const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open,value]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useEffect(()=>{if(open)list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
  const select=(index:number)=>{const option=options[index];if(option){onChange(option.value);close(true);}};
  return <div className={`choice-control ${placement}`} ref={root}><button ref={trigger} type="button" className="choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?`${id}-list`:undefined} disabled={disabled} title={title} onClick={()=>setOpen(x=>!x)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);}}}><span>{chosen?.label??label}</span><ChevronDown size={12}/></button>
    {presence.rendered&&<div ref={list} id={`${id}-list`} className={`choice-menu ${presence.leaving?'leaving':''}`} role="listbox" aria-label={label} tabIndex={-1} inert={presence.leaving} aria-hidden={presence.leaving} aria-activedescendant={`${id}-${active}`} onKeyDown={e=>{
      if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();}
      if(e.key==='ArrowDown')setActive(i=>(i+1)%options.length);else if(e.key==='ArrowUp')setActive(i=>(i-1+options.length)%options.length);else if(e.key==='Home')setActive(0);else if(e.key==='End')setActive(options.length-1);else if(e.key==='Enter'||e.key===' ')select(active);else if(e.key==='Escape')close(true);else if(e.key==='Tab'){close(true);}
    }}>{options.map((option,i)=><button type="button" role="option" tabIndex={-1} id={`${id}-${i}`} data-index={i} aria-selected={option.value===value} key={option.value} className={i===active?'highlighted':''} onPointerMove={()=>setActive(i)} onClick={()=>select(i)}><span>{option.label}</span>{option.value===value&&<Check size={13}/>}</button>)}</div>}
  </div>;
}
