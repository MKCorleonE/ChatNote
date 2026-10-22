import type { MapNode } from './mind-map';
import type { MapView, Session } from './types';
export const cardSize = {width:280,height:152};
export interface PlacedNode { node:MapNode; x:number; y:number; parentId?:string }
export interface MapEdge { source:string; target:string; kind:'main'|'branch'|'merge' }
export function mapGeometry(roots:MapNode[], session:Session, view?:MapView) {
  const placed:PlacedNode[]=[], edges:MapEdge[]=[], collapsed=new Set(view?.collapsed??[]);
  let cursor=50;
  function place(node:MapNode,depth:number,parentId?:string):number {
    const start=cursor, children=collapsed.has(node.id)?[]:node.children;
    if(children.length)for(const child of children)place(child,depth+1,node.id);
    else cursor+=cardSize.height+58;
    const saved=view?.positions[node.id];
    placed.push({node,x:saved?.x??(60+depth*365),y:saved?.y??(start+(cursor-start-cardSize.height-58)/2),parentId});
    if(parentId)edges.push({source:parentId,target:node.id,kind:'branch'});
    return cursor;
  }
  for(const root of roots){place(root,0);cursor+=30;}
  for(let i=1;i<roots.length;i++)if(roots[i-1].kind==='main'&&roots[i].kind==='main')edges.push({source:roots[i-1].id,target:roots[i].id,kind:'main'});
  const byMessage=new Map(placed.flatMap(p=>p.node.messages.map(m=>[m.id,p.node.id] as const)));
  for(const p of placed)for(const m of p.node.messages)for(const source of m.merge?.sources??[]){
    const from=source.sessionId===session.id?`branch-${source.branchId}`:undefined;
    if(from&&from!==p.node.id&&placed.some(n=>n.node.id===from))edges.push({source:from,target:byMessage.get(m.id)!,kind:'merge'});
  }
  return {placed,edges,width:Math.max(720,...placed.map(p=>p.x+cardSize.width+60)),height:Math.max(400,...placed.map(p=>p.y+cardSize.height+60))};
}
export function edgePath(a:PlacedNode,b:PlacedNode,kind:MapEdge['kind']) {
  if(kind==='main'){const x=a.x+cardSize.width/2,y=a.y+cardSize.height,ty=b.y;return `M ${x} ${y} C ${x} ${y+28},${b.x+cardSize.width/2} ${ty-28},${b.x+cardSize.width/2} ${ty}`;}
  const reverse=b.x<=a.x, sx=a.x+(reverse?0:cardSize.width),sy=a.y+cardSize.height/2,tx=b.x+(reverse?cardSize.width:0),ty=b.y+cardSize.height/2;
  // Keep return links outside the cards; short branch links use a gentle horizontal arc.
  const bend=reverse?Math.min(sx,tx)-90:((sx+tx)/2);
  return `M ${sx} ${sy} C ${bend} ${sy},${bend} ${ty},${tx} ${ty}`;
}
export function fitCamera(width:number,height:number,items:PlacedNode[]) {
  if(!items.length)return {x:40,y:40,zoom:1};
  const minX=Math.min(...items.map(n=>n.x)),minY=Math.min(...items.map(n=>n.y));
  const maxX=Math.max(...items.map(n=>n.x+cardSize.width)),maxY=Math.max(...items.map(n=>n.y+cardSize.height));
  const zoom=Math.max(.15,Math.min(1,(width-80)/(maxX-minX),(height-80)/(maxY-minY)));
  return {x:(width-(maxX-minX)*zoom)/2-minX*zoom,y:(height-(maxY-minY)*zoom)/2-minY*zoom,zoom};
}
