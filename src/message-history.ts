import type { Anchor, Branch, Message, Session } from './types';

type Thread = Pick<Session, 'messages' | 'messageHistory' | 'activeMessageIds'>;
export function activeMessages(thread: Thread): Message[] {
  if (!thread.activeMessageIds) return thread.messages;
  const records = new Map(thread.messages.map(m => [m.id, m]));
  const known = new Set([...thread.activeMessageIds, ...(thread.messageHistory ?? []).flatMap(path=>path.map(m=>m.id))]);
  // Older clients can append turns without understanding activeMessageIds.
  return [...thread.activeMessageIds.map(id=>records.get(id)!).filter(Boolean), ...thread.messages.filter(m=>!known.has(m.id))];
}
export const threadPaths = (thread: Thread): Message[][] => [activeMessages(thread), ...(thread.messageHistory ?? [])];
export const threadMessages = (thread: Thread): Message[] => thread.messages;
export const sessionMessages = (session: Session): Message[] => [...threadMessages(session), ...session.branches.flatMap(threadMessages)];
export const editDraftKey = (branchId: string | null, m: Message) => `edit:${branchId ?? 'main'}:${m.id}:${m.revision}`;
export function questionTime(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';
}

export function editThread<T extends Thread>(thread: T, id: string, text: string, answer: Message): T {
  if ((thread.messageHistory?.length ?? 0) >= 1000) throw new Error('This conversation has reached the saved version limit. Start a new conversation to continue editing.');
  const active = activeMessages(thread);
  const index = active.findIndex(m => m.id === id && m.role === 'user');
  if (index < 0) throw new Error('The question is no longer available.');
  const original = active[index];
  const question: Message = { ...original, id:crypto.randomUUID(), questionGroupId:original.questionGroupId ?? original.id, text, revision: crypto.randomUUID(), createdAt: Math.max(Date.now(), original.createdAt + 1) };
  return { ...thread, messages: [...thread.messages, question, answer], activeMessageIds:[...active.slice(0,index),question,answer].map(m=>m.id), messageHistory: [...(thread.messageHistory ?? []), active] };
}

export function questionVersions(thread: Thread, id: string): { question: Message; messages: Message[] }[] {
  const versions = new Map<string, { question: Message; messages: Message[] }>();
  const group = thread.messages.find(m=>m.id===id)?.questionGroupId ?? id;
  // Prefer the most recently saved continuation, then the active path.
  for (const messages of [...(thread.messageHistory ?? []), activeMessages(thread)]) {
    const question = messages.find(m => (m.questionGroupId ?? m.id) === group && m.role === 'user');
    if (question) versions.set(question.revision, { question, messages });
  }
  return [...versions.values()].sort((a, b) => a.question.createdAt - b.question.createdAt);
}

export function switchThreadPath<T extends Thread>(thread: T, messages: Message[]): T {
  const signature = (path:Message[]) => JSON.stringify(path.map(m=>m.id));
  const active = activeMessages(thread);
  if (signature(messages) === signature(active)) return thread;
  const selected = thread.messageHistory?.find(path=>signature(path)===signature(messages));
  if (!selected) return thread;
  return { ...thread, activeMessageIds:messages.map(m=>m.id), messageHistory: [...thread.messageHistory!.filter(path => path !== selected), active] };
}

export function appendThread<T extends Thread>(thread:T, ...messages:Message[]):T {
  return {...thread, messages:[...thread.messages,...messages], ...(thread.activeMessageIds?{activeMessageIds:[...activeMessages(thread),...messages].map(m=>m.id)}:{})};
}

export function restoreSourcePath(session: Session, anchor: Anchor, parentId: string | null): Session {
  const thread: Session | Branch | undefined = parentId ? session.branches.find(b => b.id === parentId) : session;
  if (!thread) return session;
  const path = threadPaths(thread).find(messages => messages.some(m => m.id === anchor.messageId && m.revision === anchor.revision));
  if (!path) return session;
  if (!parentId) return switchThreadPath(session, path);
  return { ...session, branches: session.branches.map(b => b.id === parentId ? switchThreadPath(b, path) : b) };
}
