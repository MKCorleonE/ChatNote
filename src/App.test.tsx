import { vi, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyWorkspace, exampleSession, message, contextFor, validAnchor, validateWorkspace, makeAnchor, snapshot } from './core';
import type { Generation, StreamEvent, Workspace } from './types';
import { activeMessages } from './message-history';
const store=vi.hoisted(()=>({initial:null as Workspace|null,saved:null as Workspace|null,requests:[] as Generation[],slow:false}));
vi.mock('./bridge',()=>({desktop:true,loadWorkspace:async()=>structuredClone(store.initial),saveWorkspace:async(w:Workspace)=>{store.saved=structuredClone(w);},profileStatus:async()=>({connected:true,planUsage:true,hasKey:true,endpointMatches:true}),openUrl:async()=>{},connection:async()=>({apiKey:true,compatibleKey:false,chatgpt:false}),models:async()=>[{id:'test-model',name:'Test model'}],setKey:async()=>{},signIn:async()=>({chatgpt:true}),signOut:async()=>{},saveFile:async()=>true,generate:async(req:Generation,onEvent:(e:StreamEvent)=>void,signal:AbortSignal)=>{store.requests.push(req);if(store.slow){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,2000);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('aborted'));},{once:true});});}onEvent({type:'delta',text:'A branch can explain this detail. '});await new Promise(r=>setTimeout(r,10));onEvent({type:'delta',text:'We keep context separate.'});onEvent({type:'done'});}}));
import App from './App';
vi.mock('@tauri-apps/api/window',()=>({getCurrentWindow:()=>({onCloseRequested:async()=>()=>{},destroy:async()=>{}})}));
beforeEach(()=>{const w=emptyWorkspace(),s=exampleSession();w.sessions=[s];w.activeId=s.id;w.settings.model='test-model';w.settings.profiles!.find(p=>p.id===w.settings.activeProfileId)!.model='test-model';store.initial=w;store.saved=null;store.requests=[];store.slow=false;window.getSelection()?.removeAllRanges();});

test('Composer prompts distinguish a new conversation, main continuation and annotation without duplicate footer labels',async()=>{
 const user=userEvent.setup();render(<App/>);const main=await screen.findByRole('textbox',{name:'Message the main conversation'});expect(main.getAttribute('placeholder')).toBe('Let’s continue the main thread?');expect((screen.getByRole('textbox',{name:'Message this annotation'})as HTMLTextAreaElement).placeholder).toBe('Continue asking?');
 expect(document.querySelector('.under-composer')?.textContent).toBe('AI can make mistakes. Please check important information.');expect(screen.queryByText('Select a passage to ask in an annotation.')).toBeNull();expect(document.querySelector('.under-composer')?.textContent).not.toContain('test-model');
 await user.click(screen.getByRole('button',{name:'New conversation'}));expect((screen.getByRole('textbox',{name:'Message the main conversation'})as HTMLTextAreaElement).placeholder).toBe('What would you like to explore?');expect(store.requests).toHaveLength(0);
});

test('Conversation rename supports focus, cancel, trimmed save and preserves conversation content and drafts',async()=>{
 const s=store.initial!.sessions[0];s.view.drafts.main='Unsent draft';const original=structuredClone(s),user=userEvent.setup();render(<App/>);const trigger=await screen.findByRole('button',{name:'Understanding Transformers'});await user.click(trigger);const dialog=screen.getByRole('dialog',{name:'Rename conversation'}),input=within(dialog).getByRole('textbox',{name:'Conversation name'});expect(document.activeElement).toBe(input);await user.clear(input);expect(within(dialog).getByRole('button',{name:'Save name'}).hasAttribute('disabled')).toBe(true);await user.type(input,'Discard this');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);
 await user.click(trigger);await user.clear(screen.getByRole('textbox',{name:'Conversation name'}));await user.type(screen.getByRole('textbox',{name:'Conversation name'}),'  New title 中文  ');await user.keyboard('{Enter}');await screen.findByRole('button',{name:'New title 中文'});await waitFor(()=>expect(store.saved?.sessions[0].title).toBe('New title 中文'));expect(store.saved!.sessions[0].messages).toEqual(original.messages);expect(store.saved!.sessions[0].branches).toEqual(original.branches);expect(store.saved!.sessions[0].view.drafts.main).toBe('Unsent draft');expect(store.requests).toHaveLength(0);
});

test('History deletes an older conversation directly, cancellation keeps it, and the active draft survives',async()=>{
 const w=store.initial!,old=emptyWorkspace().sessions[0];old.title='Old history';w.sessions.push(old);w.sessions[0].view.drafts.main='Keep active draft';const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await user.click(screen.getByRole('button',{name:'Open conversations'}));await user.click(screen.getByRole('button',{name:'Delete conversation: Old history'}));
 const dialog=await screen.findByRole('dialog',{name:'Delete conversation…'});expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:'Cancel'}));await user.click(within(dialog).getByRole('button',{name:'Cancel'}));expect(screen.getByRole('button',{name:/^Old history/})).toBeDefined();
 await user.click(screen.getByRole('button',{name:'Delete conversation: Old history'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));await waitFor(()=>expect(store.saved?.sessions).toHaveLength(1));expect(store.saved!.activeId).toBe(w.activeId);expect(store.saved!.sessions[0].view.drafts.main).toBe('Keep active draft');expect(store.requests).toHaveLength(0);expect(()=>validateWorkspace(store.saved)).not.toThrow();
});
test('Failed answer deletion removes its error and keeps the original question and unrelated answers',async()=>{
 const w=store.initial!,s=w.sessions[0],failed=message('assistant','','error');failed.error='Could not connect to the model provider. [TLS_CONNECTION_CLOSED]';s.messages.push(message('user','Failed question stays'),failed);s.view.mode='closed';const user=userEvent.setup();render(<App/>);await screen.findByText('Secure connection interrupted');await user.click(screen.getByRole('button',{name:'Delete failed answer'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));
 await waitFor(()=>expect(screen.queryByText('Secure connection interrupted')).toBeNull());await waitFor(()=>expect(store.saved?.sessions[0].messages.some(m=>m.id===failed.id)).toBe(false));expect(screen.getByText('Failed question stays')).toBeDefined();expect(screen.getByText('Three representations, three roles')).toBeDefined();expect(store.saved!.sessions[0].branches).toEqual(s.branches);expect(store.requests).toHaveLength(0);
});
test('Deleting a source answer explains annotation impact and removes the linked tree without invalid anchors',async()=>{
 const original=structuredClone(store.initial!),user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');const answer=document.querySelector('.main-scroll .message.assistant')! as HTMLElement;await user.click(within(answer).getByRole('button',{name:'Delete answer'}));
 const dialog=screen.getByRole('dialog');expect(within(dialog).getByText(/1 linked annotations or notes/)).toBeDefined();await user.click(within(dialog).getByRole('button',{name:'Cancel'}));expect(screen.getByText('Three representations, three roles')).toBeDefined();await user.click(within(answer).getByRole('button',{name:'Delete answer'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));
 await waitFor(()=>expect(store.saved?.sessions[0].branches).toHaveLength(0));expect(store.saved!.sessions[0].messages).toEqual([original.sessions[0].messages[0]]);expect(()=>validateWorkspace(store.saved)).not.toThrow();expect(store.requests).toHaveLength(0);
});
test('Deleting the only conversation from history creates a valid empty workspace',async()=>{
 const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await user.click(screen.getByRole('button',{name:'Open conversations'}));await user.click(screen.getByRole('button',{name:'Delete conversation: Understanding Transformers'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));await screen.findByText('Follow your curiosity.');await waitFor(()=>expect(store.saved?.sessions[0].messages).toHaveLength(0));expect(store.saved!.sessions).toHaveLength(1);expect(()=>validateWorkspace(store.saved)).not.toThrow();
});
test('Removing a failed answer preserves an unrelated unsent annotation and its draft',async()=>{
 const s=store.initial!.sessions[0],anchor=s.branches[0].anchor,failed=message('assistant','','error');failed.error='Could not connect to the model provider';s.messages.push(failed);s.view.mode='branch';s.view.branchId=null;s.view.draftSource={anchor,parentId:null};s.view.drafts.new='Keep unsent annotation';const user=userEvent.setup();render(<App/>);await screen.findByRole('textbox',{name:'Message this annotation'});await user.click(screen.getByRole('button',{name:'Delete failed answer'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}));expect((screen.getByRole('textbox',{name:'Message this annotation'})as HTMLTextAreaElement).value).toBe('Keep unsent annotation');await waitFor(()=>expect(store.saved?.sessions[0].view.draftSource).toEqual({anchor,parentId:null}));expect(store.requests).toHaveLength(0);
});
test('Pinned history survives selection, creation and restart, and adapts to a narrow viewport without losing its preference',async()=>{
 const width=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:1280});try{
 const other=emptyWorkspace().sessions[0];other.title='Pinned other';store.initial!.sessions.push(other);const user=userEvent.setup(),view=render(<App/>);await screen.findByText('Three representations, three roles');await user.click(screen.getByRole('button',{name:'Open conversations'}));await user.click(screen.getByRole('button',{name:'Pin conversations'}));expect(document.querySelector('.history-drawer.pinned')).not.toBeNull();expect(document.querySelector('.drawer-scrim')).toBeNull();await user.click(screen.getByRole('button',{name:/^Pinned other/}));expect(screen.getByRole('region',{name:'Conversations'})).toBeDefined();await user.click(within(screen.getByRole('region',{name:'Conversations'})).getByRole('button',{name:'New conversation'}));expect(document.querySelector('.history-drawer.pinned')).not.toBeNull();await waitFor(()=>expect(store.saved?.settings.historyPinned).toBe(true));store.initial=structuredClone(store.saved!);view.unmount();render(<App/>);await screen.findByRole('button',{name:'Unpin conversations'});expect(document.querySelector('.history-drawer.pinned')).not.toBeNull();
 Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:600});fireEvent(window,new Event('resize'));await user.click(screen.getByRole('button',{name:'Open conversations'}));expect(document.querySelector('.history-drawer.pinned')).toBeNull();expect(document.querySelector('.drawer-scrim')).not.toBeNull();await user.click(screen.getByRole('button',{name:'Close conversations'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'Conversations'})).toBeNull());expect(store.saved!.settings.historyPinned).toBe(true);
 }finally{Object.defineProperty(window,'innerWidth',{configurable:true,writable:true,value:width});fireEvent(window,new Event('resize'));}
});
test('The follow-up tree expands each round and its answer-linked child, remembers folds and opens the selected question',async()=>{
 const s=store.initial!.sessions[0],root=s.branches[0],second=message('user','Second local question'),answer=message('assistant','SECOND_ANSWER_SOURCE');root.messages.push(second,answer);const anchor=makeAnchor(answer,0,6),child={id:crypto.randomUUID(),parentId:root.id,anchor,messages:[message('user','Deeper question'),message('assistant','Deep answer')],createdAt:Date.now(),sourceContext:snapshot(s,root.id,anchor)};s.branches.push(child);const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await user.click(screen.getByRole('button',{name:/Follow-up tree/}));const tree=screen.getByRole('navigation',{name:'Follow-up tree'});expect(within(tree).getByText('Second local question')).toBeDefined();expect(within(tree).getByText('Deeper question')).toBeDefined();await user.click(within(tree).getByRole('button',{name:'Collapse question · Second local question'}));expect(within(tree).queryByText('Deeper question')).toBeNull();await waitFor(()=>expect(store.saved?.sessions[0].view.collapsed).toContain(`turn:${root.id}:${second.id}`));await user.click(within(tree).getByRole('button',{name:'Expand question · Second local question'}));expect(within(tree).getByText('Deeper question')).toBeDefined();await user.click(within(tree).getByText('Second local question').closest('button')!);await waitFor(()=>expect(store.saved?.sessions[0].view.positions[root.id]?.messageId).toBe(second.id));expect(store.saved!.sessions[0].view.mode).toBe('branch');expect(store.requests).toHaveLength(0);
});

test('Completed answers have only icon copy/context actions and a timestamp, with no completion/duration/count labels',async()=>{
  const s=store.initial!.sessions[0],answer=s.messages[1];answer.context=contextFor(s,null);answer.completedAt=Date.now();
  const original=structuredClone(s),user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  expect(document.querySelectorAll('.answer-status')).toHaveLength(0);expect(screen.queryByText('Answer complete')).toBeNull();
  const article=document.querySelector('.main-scroll .message.assistant')! as HTMLElement;
  const context=within(article).getByRole('button',{name:'View context'});expect(context.textContent).toBe('');expect(context.querySelector('svg')).not.toBeNull();
  expect(article.querySelector('.answer-time')?.getAttribute('datetime')).toBe(new Date(answer.completedAt).toISOString());
  await user.click(context);await screen.findByRole('dialog',{name:'Context details'});expect(store.requests).toHaveLength(0);
  await waitFor(()=>expect(store.saved?.sessions[0].messages).toEqual(original.messages));
});

test('Question actions copy exact text, show HH:mm and edit/cancel without a request; answer copying is an icon',async()=>{
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  const original=store.initial!.sessions[0].messages[0];
  const question=document.querySelector('.main-scroll .message.user')! as HTMLElement;
  const write=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue();
  expect(question.querySelector('.message-meta')).toBeNull();expect(question.querySelector('time')?.textContent).toMatch(/^\d{2}:\d{2}$/);
  expect(document.querySelectorAll('.message .model-label')).toHaveLength(0);
  await user.click(within(question).getByRole('button',{name:'Copy question'}));expect(write).toHaveBeenCalledWith(original.text);
  const answerCopy=document.querySelector('.main-scroll .answer-copy')! as HTMLElement;
  expect(answerCopy.textContent).toBe('');expect(answerCopy.querySelector('svg')).not.toBeNull();
  await user.click(answerCopy);expect(write).toHaveBeenCalledWith(store.initial!.sessions[0].messages[1].text);
  await user.click(within(question).getByRole('button',{name:'Edit question'}));
  const edit=screen.getByRole('textbox',{name:'Question text'});expect(document.activeElement).toBe(edit);
  await user.clear(edit);expect(screen.getByRole('button',{name:'Save & regenerate'}).hasAttribute('disabled')).toBe(true);
  await user.type(edit,'Do not send yet');await user.click(screen.getByRole('button',{name:'Cancel editing'}));
  expect(store.requests).toHaveLength(0);expect(question.querySelector('.user-text')?.textContent).toBe(original.text);write.mockRestore();
});

test('Editing an earlier main question regenerates with its prefix, preserves draft and anchors, and can restore the old version',async()=>{
  const s=store.initial!.sessions[0],original=structuredClone(s);s.messages.push(message('user','UNRELATED_LATER_QUESTION'),message('assistant','UNRELATED_LATER_ANSWER'));
  s.view.drafts.main='Keep my composer draft';const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  await user.click(within(document.querySelector('.main-scroll .message.user')! as HTMLElement).getByRole('button',{name:'Edit question'}));
  const edit=screen.getByRole('textbox',{name:'Question text'});await user.clear(edit);await user.type(edit,'Edited question 中文🧠');
  await user.click(screen.getByRole('button',{name:'Save & regenerate'}));await screen.findByText(/We keep context separate/);
  expect(store.requests).toHaveLength(1);expect(store.requests[0].input).toEqual([{role:'user',content:'Edited question 中文🧠'}]);
  await waitFor(()=>expect(store.saved?.sessions[0].messages.at(-1)?.status).toBe('complete'));
  const saved=store.saved!;expect(activeMessages(saved.sessions[0])).toHaveLength(2);expect(saved.sessions[0].messages).toHaveLength(6);expect(saved.sessions[0].messageHistory![0]).toHaveLength(4);
  expect(validAnchor(saved.sessions[0],original.branches[0].anchor)).toBe(true);expect(()=>validateWorkspace(saved)).not.toThrow();
  expect((screen.getByRole('textbox',{name:'Message the main conversation'})as HTMLTextAreaElement).value).toBe('Keep my composer draft');
  await user.click(screen.getByRole('button',{name:'Previous question version'}));await screen.findByText('Three representations, three roles');
  await user.click(screen.getByRole('button',{name:'Next question version'}));await screen.findByText('Edited question 中文🧠');
  await user.click(screen.getByRole('button',{name:'Jump to source'}));await screen.findByText('Three representations, three roles');
  expect(store.requests).toHaveLength(1);
});

test('Editing annotation questions keeps the main thread and sibling context unchanged',async()=>{
  const original=structuredClone(store.initial!.sessions[0]);const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  const question=document.querySelector('.panel-scroll .message.user')! as HTMLElement;
  await user.click(within(question).getByRole('button',{name:'Edit question'}));const edit=screen.getByRole('textbox',{name:'Question text'});await user.clear(edit);await user.type(edit,'New annotation question');
  await user.click(screen.getByRole('button',{name:'Save & regenerate'}));await screen.findByText(/We keep context separate/);
  await waitFor(()=>expect(store.saved?.sessions[0].branches[0].messages.at(-1)?.status).toBe('complete'));
  expect(store.saved!.sessions[0].messages).toEqual(original.messages);expect(store.saved!.sessions[0].branches[0].messageHistory?.[0]).toEqual(original.branches[0].messages);
  expect(store.requests[0].input.at(-1)?.content).toBe('New annotation question');expect(store.requests[0].input.some(i=>i.content===original.branches[0].messages[0].text)).toBe(false);
});

test('An edited over-budget question keeps the original transcript until context is reviewed and sent',async()=>{
  const w=store.initial!,s=w.sessions[0];s.messages=[message('user','Old question'),message('assistant','Long old explanation '.repeat(1000)),message('user','Question to edit'),message('assistant','Old answer')];s.branches=[];s.view.mode='closed';s.view.branchId=null;w.settings.contextBudget=8000;
  const user=userEvent.setup();render(<App/>);await screen.findByText('Question to edit');
  const question=document.querySelectorAll('.main-scroll .message.user')[1] as HTMLElement;await user.click(within(question).getByRole('button',{name:'Edit question'}));
  const edit=screen.getByRole('textbox',{name:'Question text'});await user.clear(edit);await user.type(edit,'Revised latest question');await user.click(screen.getByRole('button',{name:'Save & regenerate'}));
  await screen.findByRole('button',{name:'Send with this context'});expect(store.requests).toHaveLength(0);expect(screen.getByText('Old answer')).toBeDefined();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect((screen.getByRole('textbox',{name:'Question text'})as HTMLTextAreaElement).value).toBe('Revised latest question');
  await user.click(screen.getByRole('button',{name:'Save & regenerate'}));await user.click(await screen.findByRole('button',{name:'Send with this context'}));await screen.findByText(/We keep context separate/);
  expect(store.requests).toHaveLength(1);expect(store.requests[0].input.at(-1)?.content).toBe('Revised latest question');expect(JSON.stringify(store.requests[0].input)).not.toContain('Old answer');
});

test('Question editing drafts survive language switching and failed clipboard access is reported',async()=>{
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  const write=vi.spyOn(navigator.clipboard,'writeText').mockRejectedValue(new Error('Denied'));
  const question=document.querySelector('.main-scroll .message.user')! as HTMLElement;await user.click(within(question).getByRole('button',{name:'Copy question'}));await screen.findByText('Copy failed. Select the text and copy it manually.');write.mockRestore();
  await user.click(within(question).getByRole('button',{name:'Edit question'}));const edit=screen.getByRole('textbox',{name:'Question text'});await user.clear(edit);await user.type(edit,'Preserve 编辑草稿');
  await user.click(screen.getByRole('button',{name:'Open settings'}));await user.click(screen.getByRole('button',{name:'Appearance'}));await user.selectOptions(screen.getByLabelText('Interface language'),'zh-Hans');await user.click(screen.getByRole('button',{name:'关闭设置'}));
  expect((screen.getByRole('textbox',{name:'问题内容'})as HTMLTextAreaElement).value).toBe('Preserve 编辑草稿');expect(store.requests).toHaveLength(0);
});

test('Stopping an edited generation keeps both versions and disables editing while streaming',async()=>{
  store.slow=true;const original=structuredClone(store.initial!.sessions[0]),user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  await user.click(within(document.querySelector('.main-scroll .message.user')! as HTMLElement).getByRole('button',{name:'Edit question'}));
  const edit=screen.getByRole('textbox',{name:'Question text'});await user.clear(edit);await user.type(edit,'Edited question to stop');await user.click(screen.getByRole('button',{name:'Save & regenerate'}));
  await screen.findAllByRole('button',{name:'Stop generation'});expect(screen.getByRole('button',{name:'Previous question version'}).hasAttribute('disabled')).toBe(true);
  expect(screen.getAllByRole('button',{name:'Edit question'}).every(button=>button.hasAttribute('disabled'))).toBe(true);
  await user.click(screen.getAllByRole('button',{name:'Stop generation'})[0]);await screen.findByText('Stopped · partial answer saved');
  await waitFor(()=>expect(activeMessages(store.saved!.sessions[0]).at(-1)?.status).toBe('stopped'));
  expect(store.saved!.sessions[0].messages.slice(0,2)).toEqual(original.messages);expect(validAnchor(store.saved!.sessions[0],original.branches[0].anchor)).toBe(true);
  await user.click(screen.getByRole('button',{name:'Previous question version'}));await screen.findByText('Three representations, three roles');
});

test('The capsule exposes exactly three controls and a closing history can reopen without losing drafts',async()=>{
  const user=userEvent.setup(),original=structuredClone(store.initial!.sessions);
  render(<App/>);await screen.findByText('Three representations, three roles');
  expect(document.querySelectorAll('.rail-capsule button')).toHaveLength(3);
  await user.click(screen.getByRole('button',{name:'Open conversations'}));expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'Search conversations'}));
  await user.keyboard('{Escape}');
  expect(document.querySelector('.history-drawer')?.classList.contains('leaving')).toBe(true);
  await user.click(screen.getByRole('button',{name:'Open conversations'}));
  await new Promise(r=>setTimeout(r,180));expect(document.querySelector('.history-drawer')?.classList.contains('leaving')).toBe(false);
  await user.click(screen.getByRole('button',{name:'Open settings'}));await screen.findByRole('dialog',{name:'Settings'});
  await waitFor(()=>expect(document.querySelector('.history-drawer')).toBeNull());
  await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Settings'})).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'Open settings'}));
  expect(store.requests).toHaveLength(0);expect(store.initial!.sessions).toEqual(original);
});
async function selectPhrase(phrase:string){const span=[...document.querySelectorAll<HTMLElement>('[data-source-start]')].find(n=>n.childNodes.length===1&&n.firstChild?.nodeType===Node.TEXT_NODE&&n.textContent?.includes(phrase));expect(span).toBeDefined();const text=span!.firstChild!,start=text.textContent!.indexOf(phrase);const range=document.createRange();range.setStart(text,start);range.setEnd(text,start+phrase.length);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);fireEvent.mouseUp(span!);await screen.findByRole('button',{name:'Ask in annotation'});fireEvent.click(screen.getByRole('button',{name:'Ask in annotation'}));}
test('Private notes save without a model request and remain excluded from later annotation requests',async()=>{
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  const editor=screen.getByRole('textbox',{name:'Private note'});await user.type(editor,'PRIVATE_NOTE_DO_NOT_SEND');
  await waitFor(()=>expect(store.saved?.sessions[0].branches[0].note).toBe('PRIVATE_NOTE_DO_NOT_SEND'));
  expect(store.requests).toHaveLength(0);await user.type(screen.getByRole('textbox',{name:'Message this annotation'}),'Explain again');
  await user.click(screen.getAllByRole('button',{name:'Preview context'}).find(button=>!button.hasAttribute('disabled'))!);await screen.findByRole('dialog',{name:'Context details'});expect(document.querySelector('.context-list')?.textContent).not.toContain('PRIVATE_NOTE_DO_NOT_SEND');
  await user.click(screen.getByRole('button',{name:'Close context'}));await user.click(screen.getByRole('button',{name:'Send annotation message'}));await screen.findByText(/We keep context separate/);
  expect(JSON.stringify(store.requests[0])).not.toContain('PRIVATE_NOTE_DO_NOT_SEND');expect(store.saved?.sessions[0].branches[0].note).toBe('PRIVATE_NOTE_DO_NOT_SEND');
});
test('A source can have a standalone private note before any annotation question is sent',async()=>{
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await selectPhrase('Q describes');
  await user.type(screen.getByRole('textbox',{name:'Message this annotation'}),'Unsent note question');await user.type(screen.getByRole('textbox',{name:'Private note'}),'Local interpretation');await user.click(screen.getByRole('button',{name:'Save private note'}));
  await waitFor(()=>expect(store.saved?.sessions[0].branches).toHaveLength(2));const b=store.saved!.sessions[0].branches.at(-1)!;expect(b.messages).toHaveLength(0);expect(b.note).toBe('Local interpretation');expect(b.anchor.quote).toBe('Q describes');expect(store.requests).toHaveLength(0);expect((screen.getByRole('textbox',{name:'Message this annotation'})as HTMLTextAreaElement).value).toBe('Unsent note question');
});
test('Switching an annotation restores the main reading position even immediately after scrolling',async()=>{
  render(<App/>);await screen.findByText('Three representations, three roles');const main=document.querySelector('.main-scroll')! as HTMLElement;
  main.scrollTop=260;fireEvent.scroll(main);fireEvent.click(screen.getByRole('button',{name:/Follow-up tree/}));
  await waitFor(()=>expect(store.saved?.sessions[0].view.positions.main.scrollTop).toBe(260));
  expect(main.scrollTop).toBe(260);
});
test('A saved unsent selection reopens with its original source and question after restart',async()=>{
  const s=store.initial!.sessions[0];s.view.mode='branch';s.view.branchId=null;s.view.draftSource={anchor:structuredClone(s.branches[0].anchor),parentId:null};s.view.drafts.new='Unsent selection question';
  render(<App/>);await screen.findByRole('heading',{name:'New annotation'});expect((screen.getByRole('textbox',{name:'Message this annotation'})as HTMLTextAreaElement).value).toBe('Unsent selection question');
  expect(document.querySelector('.source-card blockquote')?.textContent).toBe(s.view.draftSource.anchor.quote);expect(store.requests).toHaveLength(0);
});
test('Abbreviated history requires review before sending and sends the exact reviewed context',async()=>{
  const w=store.initial!,s=w.sessions[0];s.messages=[message('user','Old question'),message('assistant','Old detail '.repeat(1400))];s.branches=[];s.view.mode='closed';s.view.branchId=null;w.settings.contextBudget=8000;
  const user=userEvent.setup();render(<App/>);await screen.findByText(/Old detail/);await user.type(screen.getByRole('textbox',{name:'Message the main conversation'}),'Current question');
  await user.click(screen.getByRole('button',{name:'Send main message'}));await screen.findByRole('button',{name:'Send with this context'});expect(store.requests).toHaveLength(0);
  const preview=document.querySelector('.context-list')!.textContent!;expect(preview).toContain('abbreviated extract');expect((screen.getByRole('textbox',{name:'Message the main conversation'})as HTMLTextAreaElement).value).toBe('Current question');
  await user.click(screen.getByRole('button',{name:'Send with this context'}));await screen.findByText(/We keep context separate/);expect(store.requests).toHaveLength(1);expect(JSON.stringify(store.requests[0].input)).toContain('abbreviated extract');
});
test('Live language switching preserves active conversations, drafts and connection edits, then survives reload',async()=>{
  const user=userEvent.setup(),original=structuredClone(store.initial!);
  const view=render(<App/>);await screen.findByText('Three representations, three roles');
  await user.type(screen.getByRole('textbox',{name:'Message the main conversation'}),'UNSENT 中文 / English draft');
  await user.click(screen.getByRole('button',{name:'Open settings'}));
  await user.clear(screen.getByLabelText('Connection name'));await user.type(screen.getByLabelText('Connection name'),'UNSAVED custom name');
  await user.type(screen.getByLabelText('API key'),'UNSAVED_SECRET');
  await user.click(screen.getByRole('button',{name:'Appearance'}));await user.selectOptions(screen.getByLabelText('Interface language'),'zh-Hans');
  await screen.findByRole('dialog',{name:'设置'});expect(document.documentElement.lang).toBe('zh-Hans');
  expect((screen.getByLabelText('API 密钥')as HTMLInputElement).value).toBe('UNSAVED_SECRET');
  await user.selectOptions(screen.getByLabelText('界面语言'),'zh-Hant');
  await screen.findByRole('dialog',{name:'設定'});expect(document.documentElement.lang).toBe('zh-Hant');
  await user.click(screen.getByRole('button',{name:'關閉設定'}));
  expect((screen.getByRole('textbox',{name:'主線訊息'})as HTMLTextAreaElement).value).toBe('UNSENT 中文 / English draft');
  await waitFor(()=>expect(store.saved?.settings.language).toBe('zh-Hant'));
  const saved=structuredClone(store.saved!);expect(saved.settings.profiles).toEqual(original.settings.profiles);
  expect(saved.sessions[0].messages).toEqual(original.sessions[0].messages);expect(saved.sessions[0].branches).toEqual(original.sessions[0].branches);
  expect(JSON.stringify(saved)).not.toContain('UNSAVED_SECRET');expect(store.requests).toHaveLength(0);
  view.unmount();store.initial=saved;render(<App/>);await screen.findByRole('textbox',{name:'主線訊息'});
  await user.click(screen.getByRole('button',{name:'開啟設定'}));await user.click(screen.getByRole('button',{name:'外觀'}));await user.selectOptions(screen.getByLabelText('介面語言'),'en');
  await screen.findByRole('dialog',{name:'Settings'});expect(document.documentElement.lang).toBe('en');
});
test('Markdown keeps source mapping, selected follow-ups and child annotations stay off the main thread',async()=>{const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');expect(document.querySelector('.katex')).not.toBeNull();const original=document.querySelectorAll('.main-scroll .message').length;await selectPhrase('Q describes');await user.type(screen.getByRole('textbox',{name:'Message this annotation'}),'Why this role?');await user.click(screen.getByRole('button',{name:'Send annotation message'}));await screen.findByText(/We keep context separate/);expect(document.querySelectorAll('.main-scroll .message')).toHaveLength(original);await selectPhrase('context separate');await user.type(screen.getByRole('textbox',{name:'Message this annotation'}),'Explain the separation');await user.click(screen.getByRole('button',{name:'Send annotation message'}));await screen.findByRole('button',{name:'Back to parent annotation'});await waitFor(()=>expect(store.saved?.sessions[0].branches).toHaveLength(3));expect(store.requests).toHaveLength(2);expect(JSON.stringify(store.requests[1].input)).toContain('Why this role?');expect(document.querySelectorAll('.main-scroll .message')).toHaveLength(original);});
test('Conversation history opens on demand and closes after selection; drafts persist',async()=>{const other=emptyWorkspace().sessions[0];other.title='Other topic';store.initial!.sessions.push(other);const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');expect(screen.queryByRole('region',{name:'Conversations'})).toBeNull();await user.type(screen.getByRole('textbox',{name:'Message the main conversation'}),'UNSENT_DRAFT');await user.click(screen.getByRole('button',{name:'Open conversations'}));await user.click(screen.getByRole('button',{name:/^Other topic/}));await waitFor(()=>expect(screen.queryByLabelText('Conversations')).toBeNull());await user.click(screen.getByRole('button',{name:'Open conversations'}));await user.click(screen.getByRole('button',{name:/Understanding Transformers.*annotation/}));expect((screen.getByRole('textbox',{name:'Message the main conversation'}) as HTMLTextAreaElement).value).toBe('UNSENT_DRAFT');});
test('Aborting generation preserves the pending question and marks the partial answer stopped',async()=>{store.slow=true;const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await user.type(screen.getByRole('textbox',{name:'Message the main conversation'}),'Continue the lesson');await user.click(screen.getByRole('button',{name:'Send main message'}));await screen.findAllByRole('button',{name:'Stop generation'});await user.click(screen.getAllByRole('button',{name:'Stop generation'})[0]);await screen.findByText('Stopped · partial answer saved');await waitFor(()=>{const m=store.saved?.sessions[0].messages.at(-1);expect(m?.status).toBe('stopped');});expect(screen.getByText('Continue the lesson')).toBeDefined();});
test('A failed load cannot silently overwrite existing records',async()=>{const bridge=await import('./bridge');const spy=vi.spyOn(bridge,'loadWorkspace').mockRejectedValueOnce(new Error('Database corrupt'));render(<App/>);await screen.findByText('Error: Database corrupt');await new Promise(r=>setTimeout(r,400));expect(store.saved).toBeNull();spy.mockRestore();});

test('Models load automatically in the composer and Alt+Enter / IME do not send; Enter sends the chosen effort',async()=>{
  const bridge=await import('./bridge'),spy=vi.spyOn(bridge,'models').mockResolvedValue([{id:'gpt-6.1-sol',name:'GPT-6.1 Sol'},{id:'gpt-5.6-sol',name:'GPT-5.6 Sol'}]);
  const w=store.initial!;w.settings.profiles!.find(p=>p.id===w.settings.activeProfileId)!.model='gpt-6.1-sol';
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');
  await waitFor(()=>expect(spy).toHaveBeenCalledTimes(1));expect(store.requests).toHaveLength(0);
  await user.click(screen.getAllByRole('button',{name:'Choose model'})[0]);await user.click(await screen.findByRole('button',{name:/GPT-5.6 Sol/}));
  await user.click(screen.getAllByRole('combobox',{name:'Reasoning effort'})[0]);await user.click(screen.getByRole('option',{name:'High'}));
  const editor=screen.getByRole('textbox',{name:'Message the main conversation'});await user.type(editor,'First line');await user.keyboard('{Alt>}{Enter}{/Alt}Second line');
  expect((editor as HTMLTextAreaElement).value).toBe('First line\nSecond line');expect(store.requests).toHaveLength(0);
  fireEvent.keyDown(editor,{key:'Enter',isComposing:true,keyCode:229});expect(store.requests).toHaveLength(0);
  fireEvent.keyDown(editor,{key:'Enter'});await screen.findByText(/We keep context separate/);
  expect(store.requests).toHaveLength(1);expect(store.requests[0].model).toBe('gpt-5.6-sol');expect(store.requests[0].reasoningEffort).toBe('high');expect(store.requests[0].input.at(-1)?.content).toBe('First line\nSecond line');
  await waitFor(()=>expect(store.saved?.sessions[0].messages.at(-1)?.reasoningEffort).toBe('high'));spy.mockRestore();
});

test('A failed catalog refresh keeps the cached models, selected model and unsent draft',async()=>{
  const bridge=await import('./bridge'),spy=vi.spyOn(bridge,'models').mockRejectedValue('Could not connect to the model provider');
  const w=store.initial!,p=w.settings.profiles!.find(p=>p.id===w.settings.activeProfileId)!;p.model='gpt-6.1-sol';
  w.settings.modelCatalogs={[p.id]:{provider:p.provider,endpoint:p.endpoint,models:[{id:p.model,name:'Saved Sol'}],updatedAt:1}};w.sessions[0].view.drafts.main='Keep my draft';
  const user=userEvent.setup();render(<App/>);await screen.findByText('Three representations, three roles');await user.click(screen.getAllByRole('button',{name:'Choose model'})[0]);
  await screen.findByRole('alert');expect(screen.getByRole('button',{name:/Saved Sol/})).toBeDefined();expect((screen.getByRole('textbox',{name:'Message the main conversation'})as HTMLTextAreaElement).value).toBe('Keep my draft');
  await waitFor(()=>expect(store.saved?.settings.model).toBe(p.model));expect(store.requests).toHaveLength(0);spy.mockRestore();
});

test('Panel width persists across restart and viewport constraints preserve the saved preference',async()=>{
  store.initial!.settings.panelWidth=400;const view=render(<App/>);await screen.findByText('Three representations, three roles');
  fireEvent.keyDown(screen.getByRole('separator',{name:'Resize annotation panel'}),{key:'ArrowLeft'});
  await waitFor(()=>expect(store.saved?.settings.panelWidth).toBe(424));const saved=structuredClone(store.saved!);view.unmount();store.initial=saved;
  render(<App/>);await screen.findByRole('separator',{name:'Resize annotation panel'});expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('424');
  fireEvent.doubleClick(screen.getByRole('separator'));await waitFor(()=>expect(store.saved?.settings.panelWidth).toBe(370));expect(store.requests).toHaveLength(0);
});


