import type { Anchor, Branch, ContextItem, ContextReport, Message, Session, Workspace } from './types';
import { migrateConnections } from './connections';
import { resolveLanguage, translator, type Language } from './i18n';
import { highlighterColors } from './annotation-style';
import { efforts } from './composer-options';
import { validateAttachment } from './attachments';
import { activeMessages, sessionMessages, threadMessages, threadPaths } from './message-history';
export const uid = () => crypto.randomUUID();
export const defaultSettings = { provider: 'openai' as const, endpoint: 'https://api.openai.com/v1', model: '', language:'en' as Language, fontSize: 15, annotations: true, theme: 'dark' as const, contextBudget: 48000 };
export function newSession(title = 'New conversation'): Session { const now = Date.now(); return { id: uid(), title, createdAt: now, updatedAt: now, messages: [], branches: [], view: { mode: 'closed', branchId: null, drafts: {}, positions: {}, collapsed: [] } }; }
export function emptyWorkspace(): Workspace { const session = newSession(); return { version: 1, sessions: [session], activeId: session.id, settings: migrateConnections({ ...defaultSettings }) }; }
export function message(role: Message['role'], text: string, status: Message['status'] = 'complete'): Message { return { id: uid(), revision: uid(), role, text, status, createdAt: Date.now() }; }
export function sourceMessage(session: Session, anchor: Anchor): Message | undefined { return sessionMessages(session).find(m => m.id === anchor.messageId && m.revision === anchor.revision); }
export function validAnchor(session: Session, anchor: Anchor): boolean { const m = sourceMessage(session, anchor); return !!m && m.role === 'assistant' && m.status !== 'streaming' && Number.isInteger(anchor.start) && Number.isInteger(anchor.end) && anchor.start >= 0 && anchor.end > anchor.start && anchor.end <= m.text.length && m.text.slice(anchor.start, anchor.end) === anchor.quote; }
export function ancestry(session: Session, id: string): Branch[] { const path: Branch[] = [], seen = new Set<string>(); let current = session.branches.find(b => b.id === id); while (current) { if (seen.has(current.id)) throw new Error('Branch cycle'); seen.add(current.id); path.unshift(current); current = session.branches.find(b => b.id === current?.parentId); } return path; }
export function makeAnchor(m: Message, start: number, end: number): Anchor { return { messageId: m.id, revision: m.revision, start, end, quote: m.text.slice(start, end), prefix: m.text.slice(Math.max(0, start - 60), start), suffix: m.text.slice(end, end + 60) }; }
export function snapshot(session: Session, parentId: string | null, anchor: Anchor): ContextItem[] {
  const thread = parentId ? session.branches.find(b => b.id === parentId) : session;
  const source = thread ? threadPaths(thread).find(path => path.some(m => m.id === anchor.messageId && m.revision === anchor.revision)) ?? [] : [];
  const end = source.findIndex(m => m.id === anchor.messageId && m.revision === anchor.revision);
  const parent = parentId ? session.branches.find(b => b.id === parentId) : undefined;
  const inherited = parent ? [...parent.sourceContext, { role: 'user' as const, content: `Parent annotation source: ${parent.anchor.quote}` }] : [];
  return [...inherited, ...source.slice(0, end + 1).filter(m => m.status === 'complete' || m.status === 'stopped').map(m => ({ role: m.role, content: m.text, ...(m.attachments?.length?{attachments:m.attachments}:{}) }))];
}
export function contextFor(session: Session, branch: Branch | null, budget = 48000): ContextReport {
  const turns = activeMessages(branch ?? session).filter(m => m.role === 'user' || m.status === 'complete').map(m => ({ role: m.role, content: m.text, ...(m.attachments?.length?{attachments:m.attachments}:{}) }));
  const history = branch ? [...branch.sourceContext, ...turns] : turns;
  const quote: ContextItem[] = branch ? [{ role: 'user', content: `This is a passage-anchored follow-up. Answer the current question about this exact source.\n\n<source>\n${branch.anchor.quote}\n</source>` }] : [];
  const size = (xs: ContextItem[]) => xs.reduce((n, i) => n + i.content.length + (i.attachments??[]).reduce((a,f)=>a+(f.kind==='text'?f.size:0),0), 0);
  const source = branch ? 'Source snapshot + this annotation only' : 'Main conversation only';
  if (size([...quote, ...history]) <= budget) return { source, characters: size([...quote, ...history]), budget, summarized: false, omittedTurns: 0, items: [...quote, ...history] };
  // Never pretend that an extract is a semantic summary; label it and preserve full originals locally.
  const recent: ContextItem[] = [];
  let available = budget - size(quote) - 2500;
  for (let i = history.length - 1; i >= 0; i--) { if (size(recent) + history[i].content.length > available) break; recent.unshift(history[i]); }
  if (!recent.length) throw new Error('Your latest question or selected source exceeds the context budget. Shorten it or increase the budget in Settings.');
  const older = history.slice(0, history.length - recent.length);
  const extract = older.map((x, i) => `[${i + 1} ${x.role}] ${x.content.slice(0, 160).replace(/\s+/g, ' ')}${x.content.length > 160 ? '…' : ''}`).join('\n').slice(0, 2200);
  const items = [...quote, { role: 'user' as const, content: `Earlier context is an abbreviated extract, not the complete history and not a verified summary. Ask for clarification if details are missing.\n${extract}` }, ...recent];
  if (size(items) > budget) throw new Error('The source and recent question exceed the context budget. Choose a shorter passage.');
  return { source, characters: size(items), budget, summarized: true, omittedTurns: older.length, items };
}
export function validateWorkspace(data: unknown): asserts data is Workspace {
  const w = data as Workspace;
  const checkAttachments=(items:unknown)=>{if(items!==undefined&&(!Array.isArray(items)||items.length>8||items.some(a=>!validateAttachment(a))))throw new Error('Invalid attachment metadata.');};
  if (!w || w.version !== 1 || !Array.isArray(w.sessions) || w.sessions.length === 0 || w.sessions.length > 2000) throw new Error('This file is not a supported ChatNote backup.');
  if(w.settings?.language!==undefined && typeof w.settings.language!=='string') throw new Error('Invalid settings.');
  if(w.settings?.followSystemTheme!==undefined&&typeof w.settings.followSystemTheme!=='boolean')throw new Error('Invalid settings.');
  if(w.settings?.historyPinned!==undefined&&typeof w.settings.historyPinned!=='boolean')throw new Error('Invalid settings.');
  if(w.settings?.panelWidth!==undefined && (!Number.isFinite(w.settings.panelWidth)||w.settings.panelWidth<300||w.settings.panelWidth>760))throw new Error('Invalid panel width.');
  const highlight=w.settings?.annotationHighlight;
  if(highlight&&(!highlighterColors.some(c=>c.id===highlight.color)||!Number.isFinite(highlight.opacity)||highlight.opacity<0||highlight.opacity>100))throw new Error('Invalid annotation highlight.');
  const glow=w.settings?.composerGlow;
  if(glow && (typeof glow.enabled!=='boolean'||!/^#[0-9a-f]{6}$/i.test(glow.colorA)||!/^#[0-9a-f]{6}$/i.test(glow.colorB)||!Number.isFinite(glow.seconds)||glow.seconds<2||glow.seconds>20||!Number.isFinite(glow.brightness)||glow.brightness<0||glow.brightness>100))throw new Error('Invalid input glow.');
  for(const p of w.settings?.profiles??[])if(p.reasoningEffort!==undefined&&!efforts.includes(p.reasoningEffort))throw new Error('Invalid reasoning effort.');
  for(const p of w.settings?.profiles??[])if((p.imageInput!==undefined&&typeof p.imageInput!=='boolean')||(p.transcriptionModel!==undefined&&(typeof p.transcriptionModel!=='string'||p.transcriptionModel.length>150)))throw new Error('Invalid media settings.');
  if(w.settings?.welcomeVersion!==undefined&&typeof w.settings.welcomeVersion!=='string')throw new Error('Invalid welcome version.');
  if(w.settings?.voiceProfileId!==undefined&&typeof w.settings.voiceProfileId!=='string')throw new Error('Invalid voice connection.');
  const catalogs=w.settings?.modelCatalogs;
  if(catalogs){if(typeof catalogs!=='object'||Array.isArray(catalogs)||Object.keys(catalogs).length>50)throw new Error('Invalid model catalogs.');for(const c of Object.values(catalogs)){if(!c||!['openai','chatgpt','compatible'].includes(c.provider)||typeof c.endpoint!=='string'||!Number.isFinite(c.updatedAt)||!Array.isArray(c.models)||c.models.length>1000||c.models.some(m=>!m||typeof m.id!=='string'||typeof m.name!=='string'||(m.reasoningEfforts!==undefined&&(!Array.isArray(m.reasoningEfforts)||m.reasoningEfforts.some(e=>!efforts.includes(e))))))throw new Error('Invalid model catalog.');}}
  const all = new Set<string>();
  for (const s of w.sessions) {
    if (!s || typeof s.id !== 'string' || all.has(s.id) || typeof s.title !== 'string' || !Array.isArray(s.messages) || !Array.isArray(s.branches)) throw new Error('Invalid or duplicate conversation.'); all.add(s.id);
    const owners = new Map<string, string>(), records = new Map<string, string>();
    for (const thread of [s, ...s.branches]) {
      if (!thread || !Array.isArray(thread.messages) || (thread.messageHistory !== undefined && (!Array.isArray(thread.messageHistory) || thread.messageHistory.length > 1000 || thread.messageHistory.some(path => !Array.isArray(path))))) throw new Error('Invalid saved question versions.');
      if (thread.activeMessageIds !== undefined && (!Array.isArray(thread.activeMessageIds) || new Set(thread.activeMessageIds).size !== thread.activeMessageIds.length || thread.activeMessageIds.some(id=>typeof id!=='string'||!thread.messages.some(m=>m.id===id)))) throw new Error('Invalid saved question versions.');
      for (const path of [thread.messages, ...(thread.messageHistory??[])]) {
        const ids = new Set<string>();
        for (const m of path) {
          if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.revision !== 'string' || typeof m.text !== 'string' || (m.questionGroupId!==undefined&&typeof m.questionGroupId!=='string') || !['user', 'assistant'].includes(m.role) || !['complete','streaming','stopped','error'].includes(m.status)) throw new Error('Invalid message.');
          ids.add(m.id);
          checkAttachments(m.attachments);for(const item of m.context?.items??[])checkAttachments(item.attachments);
          if (owners.has(m.id) && owners.get(m.id) !== thread.id) throw new Error('Invalid message.');
          owners.set(m.id, thread.id);
          const key = JSON.stringify([m.id, m.revision]), value = JSON.stringify(m);
          if (records.has(key) && records.get(key) !== value) throw new Error('Invalid saved question versions.');
          records.set(key, value);
          if(path!==thread.messages&&!thread.messages.some(original=>original.id===m.id&&original.revision===m.revision))throw new Error('Invalid saved question versions.');
        }
      }
    }
    for(const b of s.branches)if(b.note!==undefined&&(typeof b.note!=='string'||b.note.length>50000))throw new Error('Invalid private note.');
    for(const b of s.branches)for(const item of b.sourceContext??[])checkAttachments(item.attachments);
    if(s.view?.attachmentDrafts){if(typeof s.view.attachmentDrafts!=='object'||Array.isArray(s.view.attachmentDrafts))throw new Error('Invalid attachment drafts.');for(const items of Object.values(s.view.attachmentDrafts))checkAttachments(items);}
    const draft=s.view?.draftSource;if(draft&&(!draft.anchor||!validAnchor(s,draft.anchor)||(draft.parentId===null?!threadMessages(s).some(m=>m.id===draft.anchor.messageId):!s.branches.some(b=>b.id===draft.parentId&&threadMessages(b).some(m=>m.id===draft.anchor.messageId)))))throw new Error('Invalid draft source.');
    const branchIds = new Set<string>();
    for (const b of s.branches) { if (!b || typeof b.id !== 'string' || branchIds.has(b.id) || !Array.isArray(b.messages) || !Array.isArray(b.sourceContext) || b.sourceContext.some(i => !i || !['user','assistant'].includes(i.role) || typeof i.content !== 'string') || !b.anchor || !validAnchor(s, b.anchor)) throw new Error('A saved annotation has an invalid source.'); branchIds.add(b.id); }
    for (const b of s.branches) { if (b.parentId !== null) { const p = s.branches.find(p => p.id === b.parentId); if (!p || !threadMessages(p).some(m => m.id === b.anchor.messageId && m.revision === b.anchor.revision)) throw new Error('Invalid parent annotation.'); } else if (!threadMessages(s).some(m => m.id === b.anchor.messageId && m.revision === b.anchor.revision)) throw new Error('Invalid main source.'); ancestry(s, b.id); }
    if (!s.view || !['closed','tree','branch'].includes(s.view.mode) || typeof s.view.drafts !== 'object' || !s.view.positions || !Array.isArray(s.view.collapsed)) throw new Error('Invalid view state.');
  }
  if (!w.sessions.some(s => s.id === w.activeId) || !w.settings || !['openai','chatgpt','compatible'].includes(w.settings.provider) || typeof w.settings.model !== 'string' || typeof w.settings.endpoint !== 'string' || !['dark','light'].includes(w.settings.theme) || !Number.isFinite(w.settings.fontSize) || w.settings.fontSize < 12 || w.settings.fontSize > 22 || !Number.isFinite(w.settings.contextBudget) || w.settings.contextBudget < 8000 || w.settings.contextBudget > 500000 || typeof w.settings.annotations !== 'boolean') throw new Error('Invalid settings.');
  if(w.settings.profiles!==undefined){const profiles=w.settings.profiles;if(!Array.isArray(profiles)||!profiles.length||profiles.length>50)throw new Error('Invalid connection profiles.');const ids=new Set<string>();for(const p of profiles){if(!p||typeof p.id!=='string'||ids.has(p.id)||(!['legacy-openai','legacy-chatgpt','legacy-compatible'].includes(p.id)&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id))||typeof p.name!=='string'||!p.name.trim()||p.name.length>70||!['openai','chatgpt','deepseek','qwen','custom'].includes(p.preset)||!['openai','chatgpt','compatible'].includes(p.provider)||typeof p.endpoint!=='string'||typeof p.model!=='string'||'key'in p||'apiKey'in p||'access_token'in p)throw new Error('Invalid or unsafe connection profile.');ids.add(p.id);}if(!profiles.some(p=>p.id===w.settings.activeProfileId))throw new Error('Active connection is missing.');}
}
export function recoverWorkspace(w: Workspace): Workspace { w.settings=migrateConnections(w.settings);w.settings.language=resolveLanguage(w.settings.language);for (const s of w.sessions) for (const m of sessionMessages(s)) if (m.status === 'streaming') { m.status = 'stopped'; m.error = 'Interrupted when the app closed. Your partial answer was preserved.'; } return w; }
export function exportMarkdown(s: Session, language:Language='en'): string {
  const {t}=translator(language);
  const lines = [`# ${s.title}`, '', '> '+t('Created with ChatNote. Annotations keep their source and parent relationships.'), ''];
  const writtenBranches = new Set<string>();
  const writeMessage = (m: Message) => lines.push(`**${t(m.role === 'user' ? 'You' : 'Assistant')}${m.status !== 'complete' ? ` · ${t('status.'+m.status)}` : ''}**`, '', m.text, '');
  function branch(b: Branch, depth: number) { writtenBranches.add(b.id); lines.push(`${'#'.repeat(Math.min(depth + 2, 6))} ${activeMessages(b).find(m => m.role === 'user')?.text ?? t('Annotation')}`, '', `> ${t('Source')}: ${b.anchor.quote.replace(/\n/g, '\n> ')}`, ''); activeMessages(b).forEach(writeMessage); if (b.messageHistory?.length) { lines.push(`#### ${t('Saved question versions')}`, ''); b.messageHistory.forEach((path, i) => { lines.push(`##### ${i + 1}`, ''); path.forEach(writeMessage); }); } s.branches.filter(c => c.parentId === b.id).forEach(c => branch(c, depth + 1)); }
  function writeMain(path: Message[]) { for (const m of path) { lines.push(`## ${t(m.role === 'user' ? 'You' : 'Assistant')}${m.status !== 'complete' ? ` · ${t('status.'+m.status)}` : ''}`, '', m.text, ''); s.branches.filter(b => !b.parentId && b.anchor.messageId === m.id && !writtenBranches.has(b.id)).forEach(b => branch(b, 1)); } }
  writeMain(activeMessages(s));
  if (s.messageHistory?.length) { lines.push(`# ${t('Saved question versions')}`, ''); s.messageHistory.forEach((path, i) => { lines.push(`## ${i + 1}`, ''); writeMain(path); }); }
  return lines.join('\n');
}
export function exampleSession(): Session {
  const s = newSession('Understanding Transformers'); s.example = true; s.view.mode = 'branch';
  const q = message('user', 'Help me understand Transformers step by step. Start with Q, K, and V.');
  const a = message('assistant', '## Three representations, three roles\n\nEach token’s input vector is multiplied by three separate learned projection matrices to produce Query (Q), Key (K), and Value (V). Q describes what a position is looking for, K provides features to match against, and V carries the information to aggregate.\n\nThink of Q as a search request, K as an index label, and V as the information behind that label. All three are vectors learned by the model.\n\n## From scores to attention weights\n\nAttention computes the dot products of Q with each K, divides by √dₖ, and applies softmax to obtain weights. A weighted sum of V produces a new representation.\n\n$$\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$');
  s.messages = [q, a];
  const quote = 'separate learned projection matrices', start = a.text.indexOf(quote), anchor = makeAnchor(a, start, start + quote.length);
  const b: Branch = { id: uid(), parentId: null, anchor, messages: [message('user', 'Why do Q and K use different projection matrices?'), message('assistant', 'Q and K serve different roles: one expresses **what I need** and the other **what I can match**. Separate projections let the model learn these representations independently.\n\nMatching relationships do not have to be symmetric. A verb may seek information from its subject, while the subject may not attend to the verb equally.')], createdAt: Date.now(), sourceContext: snapshot(s, null, anchor) };
  s.branches = [b]; s.view.branchId = b.id; return s;
}

