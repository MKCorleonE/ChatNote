import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { usePresence } from './usePresence';
export function ChoiceMenu({label,value,options,disabled,title,onChange,placement='above'}:{label:string;value:string;options:{value:string;label:string}[];disabled?:boolean;title?:string;onChange:(value:string)=>void;placement?:'above'|'below'}){
  const [open,setOpen]=useState(false),[active,setActive]=useState(0);const presence=usePresence(open);
  const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null);
  const chosen=options.find(o=>o.value===value);
  const [position,setPosition]=useState({left:0,top:0,width:200,height:260,above:false});
  function show(){const rect=trigger.current?.getBoundingClientRect();if(rect){const above=placement==='above'?rect.top>180:window.innerHeight-rect.bottom<180&&rect.top>180;const width=Math.min(Math.max(rect.width,210),window.innerWidth-24);setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:above?window.innerHeight-rect.top+8:rect.bottom+8,width,height:Math.max(80,Math.min(260,above?rect.top-20:window.innerHeight-rect.bottom-20)),above});}setOpen(true);}
  function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
  useEffect(()=>{if(!open)return;setActive(Math.max(0,options.findIndex(o=>o.value===value)));list.current?.focus({preventScroll:true});const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!list.current?.contains(e.target as Node))setOpen(false);};const dismiss=()=>setOpen(false);const scroll=(e:Event)=>{if(!list.current?.contains(e.target as Node))show();};document.addEventListener('pointerdown',outside);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',dismiss);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',dismiss);};},[open,value]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useEffect(()=>{if(open)list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
  const select=(index:number)=>{const option=options[index];if(option){onChange(option.value);close(true);}};
  return <div className={`choice-control ${placement}`} ref={root}><button ref={trigger} type="button" className="choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?`${id}-list`:undefined} disabled={disabled} title={title} onClick={()=>open?close():show()} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();show();}}}><span>{chosen?.label??label}</span><ChevronDown size={12}/></button>
    {presence.rendered&&createPortal(<div ref={list} id={`${id}-list`} style={{position:'fixed',left:position.left,top:position.above?'auto':position.top,bottom:position.above?position.top:'auto',width:position.width,minWidth:0,maxWidth:'calc(100vw - 24px)',maxHeight:position.height,transformOrigin:position.above?'bottom left':'top left'}} className={`choice-menu floating-choice ${presence.leaving?'leaving':''}`} role="listbox" aria-label={label} tabIndex={-1} inert={presence.leaving} aria-hidden={presence.leaving} aria-activedescendant={`${id}-${active}`} onKeyDown={e=>{
      if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();}
      if(e.key==='ArrowDown')setActive(i=>(i+1)%options.length);else if(e.key==='ArrowUp')setActive(i=>(i-1+options.length)%options.length);else if(e.key==='Home')setActive(0);else if(e.key==='End')setActive(options.length-1);else if(e.key==='Enter'||e.key===' ')select(active);else if(e.key==='Escape')close(true);else if(e.key==='Tab'){close(true);}
    }}>{options.map((option,i)=><button type="button" role="option" tabIndex={-1} id={`${id}-${i}`} data-index={i} aria-selected={option.value===value} key={option.value} className={i===active?'highlighted':''} onPointerMove={()=>setActive(i)} onClick={()=>select(i)}><span>{option.label}</span>{option.value===value&&<Check size={13}/>}</button>)}</div>,document.body)}
  </div>;
}
