import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exampleSession, emptyWorkspace, makeAnchor, message, snapshot, validateWorkspace, recoverWorkspace } from './core';
import { buildMindMap, mapNodes } from './mind-map';
import { learningPrompt, learningRequest, presetPrompt, subjects } from './learning-prompts';
import { MindMap } from './MindMap';
import { catalogs } from './i18n';
import { I18nProvider } from './I18nProvider';
import { editThread } from './message-history';

test('Organization rejects empty, unanswered, failed and blank responses before a model request can be built',()=>{
  const w=emptyWorkspace(),s=w.sessions[0];
  for(const messages of [[],[message('user','Question')],[message('user','Question'),message('assistant','','error')],[message('user','Question'),message('assistant','   ')]]){s.messages=messages;expect(()=>learningRequest(s,w.settings,'zh-Hans')).toThrow('This conversation has no questions and answers yet.');}
  s.messages=[message('user','Question'),message('assistant','A partial answer','stopped')];expect(()=>learningRequest(s,w.settings,'zh-Hans')).not.toThrow();
});

test('Mind map preserves main rounds, nested branches and archived-source branches without rewriting the session',()=>{
  const s=exampleSession(),b=s.branches[0],anchor=makeAnchor(b.messages[1],0,16),child={id:crypto.randomUUID(),parentId:b.id,anchor,messages:[message('user','Nested question'),message('assistant','Nested answer $x^2$')],createdAt:0,sourceContext:snapshot(s,b.id,anchor)};
  s.branches.push(child);s.branches[0]=editThread(b,b.messages[0].id,'New parent question',message('assistant','New parent answer'));
  s.messages=[message('user','New main question'),message('assistant','New main answer')];
  const before=structuredClone(s),nodes=mapNodes(s,'en'),html=buildMindMap(s,'en');
  expect(nodes.at(-1)?.kind).toBe('archive');expect(nodes.at(-1)?.children[0].children[0].branchId).toBe(child.id);expect(html).toContain('Nested answer');expect(html).toContain('<math');expect(html).toContain(b.messages[1].text.slice(0,30));expect(s).toEqual(before);
});
test('Offline map escapes hostile titles, IDs and notes and requires no remote script, font or image',()=>{
  const s=exampleSession();s.title='</title><script>alert(1)</script>';s.branches[0].id='x"><img src=x>';s.branches[0].note='<img src=x onerror=alert(1)>';s.messages[0].text='![tracking](https://example.com/track)';const html=buildMindMap(s,'zh-Hans');expect(html).toContain('&lt;script&gt;');expect(html.match(/<script>/g)).toHaveLength(1);expect(html).not.toMatch(/<img|<link|src="https:|href="https:|onerror="/);expect(html).toContain('width=device-width');expect(html).toContain('prefers-reduced-motion');expect(html).toContain('思维导图');
});
test('Map cards open by keyboard and navigate to the real annotation question',async()=>{
  const s=exampleSession(),open=vi.fn(),user=userEvent.setup();render(<I18nProvider language="en"><MindMap session={s} onOpen={open}/></I18nProvider>);const card=document.querySelector('.canvas-node.branch')!;await user.click(within(card as HTMLElement).getByRole('button',{name:/Inspect:/}));const inspector=screen.getByRole('complementary',{name:'Discussion details'});await user.click(within(inspector).getByRole('button',{name:'Open annotation'}));expect(open).toHaveBeenCalledWith(s.branches[0].id,s.branches[0].messages[0].id);
});
test('Subject presets share six sections with localized evidence rules, while custom and saved prompts remain verbatim',()=>{
  for(const lang of ['en','zh-Hans','zh-Hant'] as const)for(const subject of subjects){const prompt=presetPrompt(subject,lang);expect(prompt.match(/^## [1-6]\./gm)).toHaveLength(6);expect(prompt).toContain(catalogs[lang][`notebook.subject.${subject}`]);}
  const p={selectedId:'custom',customPrompt:'MY custom 中文',presets:[{id:'saved',name:'Saved',prompt:'My saved prompt'}]};expect(learningPrompt(p,'zh-Hant')).toBe('MY custom 中文');expect(learningPrompt({...p,selectedId:'saved'},'en')).toBe('My saved prompt');expect(learningPrompt({...p,selectedId:'math'},'zh-Hans')).toBe(presetPrompt('math','zh-Hans'));
});
test('Request preview is the actual generation payload and excludes notes, drafts, attachment bytes and inactive messages',()=>{
  const s=exampleSession(),w=emptyWorkspace();s.branches[0].note='LOCAL_PRIVATE_NOTE';s.view.drafts.main='UNSENT_DRAFT';s.messageHistory=[[message('user','INACTIVE_PATH')]];s.messages[0].attachments=[{id:crypto.randomUUID(),name:'lesson.md',mime:'text/plain',size:2,kind:'text'}];w.settings.learningPreferences={selectedId:'computing'};const original=structuredClone(s),req=learningRequest(s,w.settings,'zh-Hans'),encoded=JSON.stringify(req);expect(encoded).toContain('lesson.md');expect(encoded).toContain('Attachment contents omitted');expect(encoded).not.toMatch(/LOCAL_PRIVATE_NOTE|UNSENT_DRAFT|INACTIVE_PATH/);expect(req.input).toHaveLength(1);expect(req.instructions).toContain('简体中文');expect(req.imageInput).toBe(false);expect(s).toEqual(original);
});
test('Prompt preferences survive workspace serialization and recovery without changing conversations or connection metadata',()=>{
  const w=emptyWorkspace(),before=structuredClone(w);w.settings.learningPreferences={selectedId:'mine',customPrompt:'Custom prompt',presets:[{id:'mine',name:'Mine',prompt:'Study biology'}]};w.settings.treeLayout='map';const loaded=JSON.parse(JSON.stringify(w));validateWorkspace(loaded);recoverWorkspace(loaded);expect(loaded.settings.learningPreferences).toEqual(w.settings.learningPreferences);expect(loaded.sessions).toEqual(before.sessions);expect(loaded.settings.profiles).toEqual(before.settings.profiles);
  loaded.settings.learningPreferences!.presets!.push({id:'mine',name:'Duplicate',prompt:'oops'});expect(()=>validateWorkspace(loaded)).toThrow('Invalid learning presets');
});
