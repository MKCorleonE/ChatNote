import {expect,test,vi} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {exampleSession,emptyWorkspace,message,validateWorkspace,validAnchor} from './core';
import {I18nProvider} from './I18nProvider';
import {LearningNoteDialog} from './LearningNoteDialog';
import {learningSourceVersion,keepLearningDraft} from './learning-drafts';
import {personalExport,sharedExport,scopedSession} from './export-scope';
import {buildLearningNote} from './learning-note';
import {searchWorkspace,revealSearchHit} from './search';
import {packSession,unpackSession,storageWorkspace,unpackWorkspace,storageSnapshot} from './workspace-storage';
import {editThread,activeMessages} from './message-history';

test('Organized drafts and interrupted text survive workspace round trips, without losing previous drafts',()=>{
 let s=exampleSession();const original=structuredClone(s),first={id:'first',text:'Saved first draft',updatedAt:1,partial:false,sourceVersion:learningSourceVersion(s)};
 s=keepLearningDraft(s,first);s=keepLearningDraft(s,{...first,id:'second',text:'Interrupted text',partial:true});s=keepLearningDraft(s,{...s.learningDraft!,text:'More interrupted text'});
 expect(s.learningHistory).toEqual([first]);expect(learningSourceVersion(s)).toBe(first.sourceVersion);
 s=unpackSession(JSON.parse(packSession(s)));expect(s.learningDraft?.text).toBe('More interrupted text');expect(s.learningDraft?.partial).toBe(true);expect(s.messages).toEqual(original.messages);expect(validAnchor(s,s.branches[0].anchor)).toBe(true);
 s=keepLearningDraft(s,first);expect(s.learningHistory?.map(d=>d.id)).toEqual(['second']);
 s={...s,messages:[...s.messages,message('user','A new question')]};expect(learningSourceVersion(s)).not.toBe(first.sourceVersion);
 const w=emptyWorkspace();w.sessions=[s];w.activeId=s.id;expect(()=>validateWorkspace(w)).not.toThrow();
});
test('Closing and reopening the notebook restores saved model text and edits flow back to its conversation',async()=>{
 const s=exampleSession();s.learningDraft={id:'draft',text:'Previously organized content',partial:true,updatedAt:1,sourceVersion:learningSourceVersion(s)};
 const change=vi.fn(),user=userEvent.setup();const view=render(<I18nProvider language="en"><LearningNoteDialog session={s} settings={emptyWorkspace().settings} onPreferences={()=>{}} onClose={()=>{}} onNotice={()=>{}} onDraft={change}/></I18nProvider>);
 expect(screen.getByText('Previously organized content')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Edit organized draft'}));await user.type(screen.getByRole('textbox',{name:'Organized draft text'}),' edited');await waitFor(()=>expect(change).toHaveBeenCalled(),{timeout:1500});
 view.unmount();const saved=change.mock.calls.at(-1)![0];expect(saved.text).toBe('Previously organized content edited');expect(saved.partial).toBe(true);
});
test('Full-text search finds exact messages, notes and archived paths without modifying sources',()=>{
 const s=exampleSession(),source=s.messages[1],original=source.text;s.branches[0].note='Private research marker';s.messages[1]={...source,text:original+' İSTANBUL emoji😀 UNIQUEMARK'};
 const versioned=editThread(s,s.messages[0].id,'A new main question',message('assistant','New answer'));
 const note=searchWorkspace([versioned],'research marker').hits[0];expect(note.kind).toBe('note');expect(note.branchId).toBe(s.branches[0].id);
 const hit=searchWorkspace([versioned],'uniquemark').hits.find(h=>h.messageId===source.id)!;expect(hit.archived).toBe(true);expect(hit.text.slice(hit.start,hit.end)).toBe('UNIQUEMARK');
 const revealed=revealSearchHit(versioned,hit);expect(activeMessages(revealed).some(m=>m.id===source.id)).toBe(true);expect(revealed.view.positions.main.messageId).toBe(source.id);expect(revealed.branches[0].anchor).toEqual(s.branches[0].anchor);expect(versioned.activeMessageIds).not.toEqual(revealed.activeMessageIds);
 expect(searchWorkspace([versioned],'nomatch').hits).toEqual([]);expect(searchWorkspace([versioned],'',1).hits).toEqual([]);
});
test('Sharing excludes private notes, files, unrelated old answers and organized drafts; personal export preserves them',()=>{
 const s=exampleSession();s.branches[0].note='PRIVATE_NOT_FOR_SHARING';s.messages[0].attachments=[{id:'file',name:'private.pdf',kind:'document',mime:'application/pdf',size:4}];
 s.messageHistory=[[message('user','OLD_PRIVATE_QUESTION'),message('assistant','OLD_PRIVATE_ANSWER')]];s.learningDraft={id:'d',text:'PRIVATE_DRAFT',partial:false,updatedAt:1,sourceVersion:''};const before=structuredClone(s);
 const shared=scopedSession(s,sharedExport),html=buildLearningNote(shared,'en',shared.learningDraft?.text??'');expect(html).not.toMatch(/PRIVATE_NOT_FOR_SHARING|OLD_PRIVATE_ANSWER|OLD_PRIVATE_QUESTION|private.pdf|PRIVATE_DRAFT/);expect(html).toContain(s.branches[0].anchor.quote.slice(0,20));expect(s).toEqual(before);
 const personal=scopedSession(s,personalExport);expect(personal.branches[0].note).toBe('PRIVATE_NOT_FOR_SHARING');expect(personal.messages[0].attachments).toEqual(s.messages[0].attachments);
});
test('Context text is stored once and restored byte-for-byte; only changed sessions need encoding',()=>{
 const w=emptyWorkspace(),s=exampleSession(),body='长段落😀\n'.repeat(1000);s.messages[1].context={source:'main',characters:body.length,budget:48000,summarized:false,omittedTurns:0,items:[{role:'user',content:body}],candidates:[{role:'user',content:body}]};
 s.branches[0].sourceContext=[{role:'user',content:body}];w.sessions.push(s);const raw=storageWorkspace(w);expect(raw.length).toBeLessThan(JSON.stringify(w).length*0.7);expect(unpackWorkspace(JSON.parse(raw))).toEqual({...w,trash:[]});expect(unpackSession(JSON.parse(packSession(s)))).toEqual(s);
 const cache=new WeakMap(),first=storageSnapshot(w,cache);const next=storageSnapshot({...w,sessions:[w.sessions[0],{...s,title:'Changed'}]},cache);expect(next.records.get(w.sessions[0].id)).toBe(first.records.get(w.sessions[0].id));expect(next.records.get(s.id)).not.toBe(first.records.get(s.id));
 const corrupted=JSON.parse(packSession(s));corrupted.storageText=[];expect(()=>unpackSession(corrupted)).toThrow('Invalid stored context');
});
