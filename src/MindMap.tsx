import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, ChevronDown, Focus, GitMerge, LayoutGrid, Minus, Plus, Undo2, X } from 'lucide-react';
import { mapNodes, mapExcerpt } from './mind-map';
import { cardSize, edgePath, fitCamera, mapGeometry } from './map-geometry';
import { RichText } from './RichText';
import { message, sourceMessage } from './core';
import { useI18n } from './I18nProvider';
import type { MapView, Session } from './types';
type Camera={x:number;y:number;zoom:number};
type Gesture={kind:'pan'|'node'|'box';id?:string;x:number;y:number;camera:Camera;position?:{x:number;y:number}};
export function MindMap({session,onOpen,onViewChange,onMerge,mergeBlocked=false}:{session:Session;onOpen?:(id:string,messageId?:string)=>void;onViewChange?:(view:MapView)=>void;onMerge?:(ids:string[])=>void;mergeBlocked?:boolean}) {
  const {t,language,n}=useI18n(),roots=useMemo(()=>mapNodes(session,language),[session.messages,session.branches,session.activeMessageIds,language]);
  const [view,setView]=useState<MapView>(()=>session.view.map??{positions:{},collapsed:[]});
  const [camera,setCamera]=useState<Camera>(()=>view.camera??{x:24,y:24,zoom:.8}),[inspected,setInspected]=useState(''),[selected,setSelected]=useState<string[]>([]);
  const [box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null),[moving,setMoving]=useState(false),[history,setHistory]=useState<MapView[]>([]);
  const viewport=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),moved=useRef(false),cameraRef=useRef(camera),viewRef=useRef(view);
  const geometry=useMemo(()=>mapGeometry(roots,session,view),[roots,session,view]),lookup=new Map(geometry.placed.map(p=>[p.node.id,p])),node=lookup.get(inspected)?.node;
  const geometryRef=useRef(geometry);geometryRef.current=geometry;
  const originBranch=node?.branchId?session.branches.find(b=>b.id===node.branchId):undefined,origin=originBranch?sourceMessage(session,originBranch.anchor):undefined;
  const focused=new Set<string>(inspected?[inspected]:[]);
  let added=true;while(added){added=false;for(const edge of geometry.edges)if(focused.has(edge.target)&&!focused.has(edge.source)){focused.add(edge.source);added=true;}}
  function save(next:MapView){viewRef.current=next;setView(next);onViewChange?.(next);}
  function moveCamera(next:Camera,persist=true){next={...next,x:Math.max(-100000,Math.min(100000,next.x)),y:Math.max(-100000,Math.min(100000,next.y))};cameraRef.current=next;setCamera(next);if(persist)save({...viewRef.current,camera:next});}
  function checkpoint(){setHistory(old=>[...old.slice(-9),structuredClone(viewRef.current)]);}
  function fit(){const el=viewport.current;if(el)moveCamera(fitCamera(el.clientWidth||1000,el.clientHeight||650,geometryRef.current.placed));}
  useEffect(()=>{
    const el=viewport.current;if(!el)return;let width=0,height=0,frame=0;
    const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;if(width&&Math.abs(width-w)+Math.abs(height-h)>2||!width&&(!viewRef.current.camera||w<760))fit();width=w;height=h;});};
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener('resize',resize);resize();
    return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resize);};
  },[]);
  function zoom(factor:number,point?:{x:number;y:number}){const el=viewport.current,c=cameraRef.current,p=point??{x:(el?.clientWidth??1000)/2,y:(el?.clientHeight??650)/2},z=Math.min(2,Math.max(.15,c.zoom*factor));moveCamera({x:p.x-(p.x-c.x)/c.zoom*z,y:p.y-(p.y-c.y)/c.zoom*z,zoom:z});}
  function start(event:PointerEvent<HTMLDivElement>,kind:Gesture['kind'],id?:string){if(event.button!==0)return;event.preventDefault();event.stopPropagation();const p=id?lookup.get(id):undefined;gesture.current={kind,id,x:event.clientX,y:event.clientY,camera:{...cameraRef.current},position:p?{x:p.x,y:p.y}:undefined};moved.current=false;setMoving(true);event.currentTarget.setPointerCapture?.(event.pointerId);if(kind==='node')checkpoint();}
  function drag(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(Math.abs(dx)+Math.abs(dy)>4)moved.current=true;
    if(g.kind==='pan')moveCamera({...g.camera,x:g.camera.x+dx,y:g.camera.y+dy},false);
    if(g.kind==='node'&&g.id&&g.position){const next={...viewRef.current,positions:{...viewRef.current.positions,[g.id]:{x:Math.max(0,Math.min(100000,g.position.x+dx/g.camera.zoom)),y:Math.max(0,Math.min(100000,g.position.y+dy/g.camera.zoom))}}};viewRef.current=next;setView(next);}
    if(g.kind==='box'){const rect=viewport.current!.getBoundingClientRect(),x1=(g.x-rect.left-g.camera.x)/g.camera.zoom,y1=(g.y-rect.top-g.camera.y)/g.camera.zoom,x2=x1+dx/g.camera.zoom,y2=y1+dy/g.camera.zoom;setBox({x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)});}}
  function end(){const g=gesture.current;if(!g)return;if(g.kind==='box'&&box)setSelected(geometry.placed.filter(p=>p.node.branchId&&p.x<box.x+box.width&&p.x+cardSize.width>box.x&&p.y<box.y+box.height&&p.y+cardSize.height>box.y).map(p=>p.node.branchId!));if(g.kind==='pan')save({...viewRef.current,camera:cameraRef.current});if(g.kind==='node')save(viewRef.current);gesture.current=null;setMoving(false);setBox(null);}
  const toggle=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const rich=(text:string)=><RichText message={message('assistant',text)} branches={[]} enabled={false} onOpen={()=>{}}/>;
  return <div className={`map-workbench ${moving?'is-moving':''} ${camera.zoom<.6?'map-distant':''}`}>
    <div className="map-toolbar" role="toolbar" aria-label={t('Canvas controls')}>
      <div className="map-tool-group"><button aria-label={t('Zoom out')} onClick={()=>zoom(1/1.2)}><Minus size={15}/></button><output>{n(Math.round(camera.zoom*100))}%</output><button aria-label={t('Zoom in')} onClick={()=>zoom(1.2)}><Plus size={15}/></button></div>
      <button onClick={fit}><Focus size={15}/><span>{t('Fit all')}</span></button>
      <button onClick={()=>{const p=lookup.get(inspected)||geometry.placed.find(p=>p.node.branchId===session.view.branchId)||geometry.placed[0];if(p&&viewport.current)moveCamera({x:viewport.current.clientWidth/2-(p.x+cardSize.width/2),y:viewport.current.clientHeight/2-(p.y+cardSize.height/2),zoom:1});}}><Focus size={15}/><span>{t('Current node')}</span></button>
      <button onClick={()=>{checkpoint();const next={...view,positions:{}},g=mapGeometry(roots,session,next),el=viewport.current,c=fitCamera(el?.clientWidth||1000,el?.clientHeight||650,g.placed);save({...next,camera:c});moveCamera(c,false);}}><LayoutGrid size={15}/><span>{t('Auto arrange')}</span></button>
      <button disabled={!history.length} aria-label={t('Undo layout')} onClick={()=>{const previous=history.at(-1)!;save(previous);if(previous.camera)moveCamera(previous.camera,false);setHistory(old=>old.slice(0,-1));}}><Undo2 size={15}/></button>
      {onMerge&&<button className="map-merge" disabled={mergeBlocked||(!selected.length&&!node?.branchId)} onClick={()=>onMerge(selected.length?selected:[node!.branchId!])}><GitMerge size={15}/>{t('Merge discussions')}{selected.length>0&&<small>{n(selected.length)}</small>}</button>}
      <span className="map-hint">{t('Drag to move · scroll to zoom · Shift-drag to select')}</span>
    </div>
    <div className="map-content"><div ref={viewport} className="map-viewport" tabIndex={0} role="region" aria-label={t('Discussion canvas')}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.key==='0'?fit():zoom(e.key==='-'?1/1.2:1.2);}if(e.key==='Escape'){setInspected('');setSelected([]);e.stopPropagation();}}}
      onWheel={e=>{if((e.target as HTMLElement).closest('button,input'))return;const rect=e.currentTarget.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-rect.left,y:e.clientY-rect.top});}}
      onPointerDown={e=>{if((e.target as HTMLElement).closest('.canvas-node'))return;start(e,e.shiftKey?'box':'pan');}} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}>
      <div className="map-world" style={{width:geometry.width,height:geometry.height,transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`}}>
        <svg className="map-edges" width={geometry.width} height={geometry.height} aria-hidden="true">{geometry.edges.map((edge,i)=>{const a=lookup.get(edge.source),b=lookup.get(edge.target);return a&&b?<path key={i} className={`map-edge ${edge.kind} ${focused.has(edge.source)&&focused.has(edge.target)?'on-path':''}`} d={edgePath(a,b,edge.kind)}/>:null;})}</svg>
        {geometry.placed.map(p=><article key={p.node.id} className={`canvas-node ${p.node.kind} ${inspected===p.node.id?'inspected':''} ${selected.includes(p.node.branchId??'')?'selected':''} ${focused.size&&!focused.has(p.node.id)?'receded':''}`} style={{left:p.x,top:p.y,width:cardSize.width,height:cardSize.height}} data-node-id={p.node.id}>
          <div className="canvas-node-heading" onPointerDown={e=>start(e,'node',p.node.id)}><span>{t(p.node.messages.some(m=>m.merge)?'Merged discussion material':p.node.kind==='branch'?'Follow-up':p.node.kind==='archive'?'Saved question versions':'Main conversation')}</span>{p.node.branchId&&<input type="checkbox" aria-label={t('Select follow-up: {name}',{name:p.node.title})} checked={selected.includes(p.node.branchId)} onPointerDown={e=>e.stopPropagation()} onChange={()=>toggle(p.node.branchId!)}/>}</div>
          <button className="canvas-node-open" aria-label={t('Inspect: {name}',{name:p.node.title})} onClick={e=>{if(e.shiftKey&&p.node.branchId)toggle(p.node.branchId);else setInspected(p.node.id);}}><strong>{p.node.title}</strong><span>{mapExcerpt(p.node)}</span></button>
          <div className="canvas-node-footer"><small>{n(p.node.messages.length)} · {t('Messages')}{p.node.note?' · '+t('My understanding'):''}</small>{p.node.children.length>0&&<button aria-label={t(view.collapsed.includes(p.node.id)?'Expand follow-ups':'Collapse follow-ups')} aria-expanded={!view.collapsed.includes(p.node.id)} onClick={()=>{checkpoint();save({...view,collapsed:view.collapsed.includes(p.node.id)?view.collapsed.filter(id=>id!==p.node.id):[...view.collapsed,p.node.id]});}}><ChevronDown size={13}/>{n(p.node.children.length)}</button>}</div>
        </article>)}
        {box&&<div className="map-selection-box" style={{left:box.x,top:box.y,width:box.width,height:box.height}}/>}
      </div>
      {!geometry.placed.length&&<div className="map-empty">{t('Your questions will grow here.')}</div>}
      <div className="map-legend"><span className="legend-main">{t('Main conversation')}</span><span className="legend-branch">{t('Follow-up')}</span><span className="legend-merge">{t('Merge source')}</span></div>
      {geometry.placed.length>0&&<svg className="map-minimap" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="button" tabIndex={0} aria-label={t('Canvas overview')} onClick={fit} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fit();}}}>{geometry.placed.map(p=><rect key={p.node.id} x={p.x} y={p.y} width={cardSize.width} height={cardSize.height} className={p.node.id===inspected?'active':''}/>)}<rect className="minimap-view" x={-camera.x/camera.zoom} y={-camera.y/camera.zoom} width={(viewport.current?.clientWidth??1000)/camera.zoom} height={(viewport.current?.clientHeight??650)/camera.zoom}/></svg>}
    </div>
    {node&&<aside className="map-inspector" key={node.id} aria-label={t('Discussion details')}><header><span>{t('Discussion details')}</span><button className="icon-button" aria-label={t('Close details')} onClick={()=>setInspected('')}><X size={16}/></button></header><div className="map-inspector-scroll"><h3>{node.title}</h3>{node.source&&<blockquote>{rich(node.source)}</blockquote>}{origin&&<details><summary>{t('Full explanation and source')}</summary>{rich(origin.text)}</details>}{node.messages.map(m=><article key={m.id}><small>{t(m.role==='user'?'You':'Assistant')}</small>{rich(m.text)}</article>)}{node.note&&<aside><strong>{t('My understanding')}</strong>{rich(node.note)}</aside>}{node.archived?.length?<details><summary>{t('Saved question versions')}</summary>{node.archived.flatMap(path=>path.map(m=><article key={m.id+'-'+m.revision}>{rich(m.text)}</article>))}</details>:null}</div><footer>{onOpen&&node.kind!=='archive'&&<button onClick={()=>onOpen(node.branchId??'',node.messages[0]?.id)}><ArrowUpRight size={15}/>{t(node.branchId?'Open annotation':'Open in main')}</button>}{onMerge&&node.branchId&&<button disabled={mergeBlocked} onClick={()=>onMerge([node.branchId!])}><GitMerge size={15}/>{t('Bring back to main')}</button>}</footer></aside>}
    </div>
  </div>;
}
