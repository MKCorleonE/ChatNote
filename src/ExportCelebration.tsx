import { useEffect, useState, type CSSProperties } from 'react';
export function ExportCelebration({burst}:{burst:number}) {
  const [visible,setVisible]=useState(false);
  useEffect(()=>{if(!burst||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;setVisible(true);const timer=setTimeout(()=>setVisible(false),2800);return()=>clearTimeout(timer);},[burst]);
  if(!visible)return null;
  return <div className="export-confetti" key={burst} aria-hidden="true">{Array.from({length:64},(_,i)=><i key={i} style={{'--launch':i%2?'82%':'18%','--flight-x':`${(i%2?-1:1)*(80+(i*73)%440)}px`,'--flight-y':`${-180-(i*47)%320}px`,'--fall-x':`${(i%2?-1:1)*(120+(i*61)%500)}px`,'--twist':`${360+(i*113)%900}deg`,'--delay':`${(i*17)%230}ms`,'--color':['#7dbb94','#dfc975','#86b7c4','#c19ecb','#e0a286'][i%5]} as CSSProperties}/>)}</div>;
}
