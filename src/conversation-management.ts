import { newSession } from './core';
import type { Session, Workspace } from './types';

export function hasConversation(session:Session):boolean {
  return session.messages.length>0||session.branches.length>0||!!session.messageHistory?.some(path=>path.length>0);
}
export function startConversation(workspace:Workspace,title:string):Workspace {
  const current=workspace.sessions.find(s=>s.id===workspace.activeId);
  // A draft is still the current input page, not a history entry. Reuse it intact.
  if(current&&!hasConversation(current))return workspace;
  const session=newSession(title);
  return {...workspace,sessions:[session,...workspace.sessions],activeId:session.id};
}

export function affectedBranches(session:Session, messageId:string):Set<string> {
  const removed=new Set(session.branches.filter(b=>b.anchor.messageId===messageId).map(b=>b.id));
  let changed=true;
  while(changed){changed=false;for(const b of session.branches)if(b.parentId&&removed.has(b.parentId)&&!removed.has(b.id)){removed.add(b.id);changed=true;}}
  return removed;
}
export function deleteAnswer(session:Session, messageId:string):Session {
  const answer=[...session.messages,...session.branches.flatMap(b=>b.messages)].find(m=>m.id===messageId&&m.role==='assistant');
  if(!answer)return session;
  const removed=affectedBranches(session,messageId);
  const removedMessages=new Set([messageId,...session.branches.filter(b=>removed.has(b.id)).flatMap(b=>b.messages.map(m=>m.id))]);
  if(answer.status==='streaming'||session.branches.some(b=>removed.has(b.id)&&b.messages.some(m=>m.status==='streaming')))throw new Error('Stop generation before deleting.');
  const strip=<T extends Pick<Session,'messages'|'activeMessageIds'|'messageHistory'>>(thread:T):T=>{
    const messages=thread.messages.filter(m=>!removedMessages.has(m.id));
    const active=thread.activeMessageIds?.filter(id=>!removedMessages.has(id));
    const seen=new Set<string>(active?[JSON.stringify(active)]:[JSON.stringify(messages.map(m=>m.id))]);
    const history=thread.messageHistory?.map(path=>path.filter(m=>!removedMessages.has(m.id))).filter(path=>{const key=JSON.stringify(path.map(m=>m.id));if(!path.length||seen.has(key))return false;seen.add(key);return true;});
    return {...thread,messages,...(active?{activeMessageIds:active}:{}),...(history?{messageHistory:history}:{})};
  };
  const branchDeleted=!!session.view.branchId&&removed.has(session.view.branchId);
  const source=session.view.draftSource;
  const draftDeleted=!!source&&(removedMessages.has(source.anchor.messageId)||!!source.parentId&&removed.has(source.parentId));
  return {...strip(session),updatedAt:Date.now(),branches:session.branches.filter(b=>!removed.has(b.id)).map(strip),view:{...session.view,
    ...(branchDeleted?{branchId:null}:{}),
    ...(session.view.mode==='branch'&&(branchDeleted||!session.view.branchId&&draftDeleted)?{mode:'closed' as const}:{}),
    draftSource:draftDeleted?undefined:source,
    drafts:Object.fromEntries(Object.entries(session.view.drafts).filter(([key])=>!removed.has(key)&&![...removed].some(id=>key.startsWith(`edit:${id}:`))&&![...removedMessages].some(id=>key.startsWith(`note:${id}:`)||key.includes(`:${id}:`)))),
    positions:Object.fromEntries(Object.entries(session.view.positions).filter(([key,p])=>!removed.has(key)&&!removedMessages.has(p.messageId))),
    collapsed:session.view.collapsed.filter(key=>!removed.has(key)&&![...removed].some(id=>key.startsWith(`turn:${id}:`)))
  }};
}
export function deleteConversation(workspace:Workspace, id:string, emptyTitle:string):Workspace {
  if(!workspace.sessions.some(s=>s.id===id))return workspace;
  const sessions=workspace.sessions.filter(s=>s.id!==id);
  if(!sessions.length)sessions.push(newSession(emptyTitle));
  return {...workspace,sessions,activeId:workspace.activeId===id?sessions[0].id:workspace.activeId};
}
