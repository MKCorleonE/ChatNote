import type { LearningDraft, Session } from './types';
import { activeMessages } from './message-history';

export function learningSourceVersion(session:Session):string {
  const source=JSON.stringify([session.title,...[session,...session.branches].map(thread=>[
    'anchor' in thread?thread.anchor:null,
    ...activeMessages(thread).map(m=>[m.id,m.revision,m.text,m.status,m.attachments]),
  ])]);
  let a=2166136261,b=5381;for(let i=0;i<source.length;i++){a=Math.imul(a^source.charCodeAt(i),16777619);b=Math.imul(b,33)^source.charCodeAt(i);}
  return `${source.length}:${a>>>0}:${b>>>0}`;
}
export function keepLearningDraft(session:Session,draft:LearningDraft):Session {
  const previous=session.learningDraft;
  const history=previous?.text&&previous.id!==draft.id
    ?[...(session.learningHistory??[]).filter(d=>d.id!==draft.id&&d.id!==previous.id),previous]:session.learningHistory;
  return {...session,learningDraft:draft,...(history?{learningHistory:history}:{})};
}
