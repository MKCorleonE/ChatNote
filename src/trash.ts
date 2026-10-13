import type { Workspace } from './types';
import { deleteConversation } from './conversation-management';
export const trashLifetime=24*60*60*1000;
export function trashConversation(w:Workspace,id:string,title:string,now=Date.now()):Workspace {
  const session=w.sessions.find(s=>s.id===id);if(!session)return w;
  return {...deleteConversation(w,id,title),trash:[{session:structuredClone(session),deletedAt:now},...w.trash??[]]};
}
export function restoreConversation(w:Workspace,id:string):Workspace {
  const entry=w.trash?.find(e=>e.session.id===id);if(!entry)return w;
  if(w.sessions.some(s=>s.id===id))throw new Error('A conversation with this ID already exists.');
  return {...w,sessions:[entry.session,...w.sessions],activeId:id,trash:w.trash!.filter(e=>e!==entry)};
}
export function purgeTrash(w:Workspace,ids:string[]):Workspace {const removed=new Set(ids);return {...w,trash:w.trash?.filter(e=>!removed.has(e.session.id))??[]};}
export function expiredTrash(w:Workspace,now=Date.now()):string[] {return (w.trash??[]).filter(e=>now-e.deletedAt>=trashLifetime).map(e=>e.session.id);}
