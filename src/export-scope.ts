import type { Session } from './types';
export interface ExportScope { notes:boolean; history:boolean; attachments:boolean; organized:boolean }
export const personalExport:ExportScope={notes:true,history:true,attachments:true,organized:true};
// Model drafts may quote private material, so sharing excludes them until explicitly selected.
export const sharedExport:ExportScope={notes:false,history:false,attachments:false,organized:false};
export function scopedSession(session:Session,scope:ExportScope):Session {
  const cleanThread=<T extends Pick<Session,'messages'|'messageHistory'>>(thread:T):T=>({
    ...thread,messages:thread.messages.map(m=>scope.attachments?m:{...m,attachments:undefined}),
    messageHistory:scope.history?thread.messageHistory:undefined,
  });
  // Inactive messages are kept only when they are needed by an exact-source anchor.
  const result={...cleanThread(session),branches:session.branches.map(b=>({...cleanThread(b),note:scope.notes?b.note:undefined})),
    learningDraft:scope.organized?session.learningDraft:undefined,learningHistory:undefined};
  if(!scope.history){
    const needed=new Set(session.branches.map(b=>b.anchor.messageId));
    for(const thread of [result,...result.branches]){
      const active=new Set(thread.activeMessageIds??thread.messages.map(m=>m.id));
      thread.messages=thread.messages.filter(m=>active.has(m.id)||needed.has(m.id));
      thread.messageHistory=thread.messages.filter(m=>!active.has(m.id)).map(m=>[m]);
    }
  }
  return result;
}
