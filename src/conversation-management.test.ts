import { expect,test } from 'vitest';
import { affectedBranches,deleteAnswer,deleteConversation,hasConversation,startConversation } from './conversation-management';
import { contextFor,emptyWorkspace,exampleSession,makeAnchor,message,newSession,snapshot,validateWorkspace } from './core';
import { activeMessages,editThread } from './message-history';
import type { Branch,Session } from './types';
function child(s:Session,parent:Branch|null,answerId:string):Branch {const m=(parent?.messages??s.messages).find(m=>m.id===answerId)!;const anchor=makeAnchor(m,0,Math.min(20,m.text.length));return {id:crypto.randomUUID(),parentId:parent?.id??null,anchor,messages:[message('user','Nested question'),message('assistant','Nested answer text')],createdAt:Date.now(),sourceContext:snapshot(s,parent?.id??null,anchor)};}

test('New blank conversations stay out of history and repeated creation reuses the intact input draft',()=>{
 const w=emptyWorkspace(),s=w.sessions[0];s.view.drafts.main='Unsent draft';const original=structuredClone(w);expect(hasConversation(s)).toBe(false);expect(startConversation(w,'New conversation')).toBe(w);expect(w).toEqual(original);
 s.messages.push(message('user','A sent question'),message('assistant','','error'));expect(hasConversation(s)).toBe(true);const next=startConversation(w,'New conversation');expect(next.sessions.filter(hasConversation)).toEqual([s]);expect(startConversation(next,'New conversation')).toBe(next);expect(next.sessions).toHaveLength(2);expect(next.settings).toBe(w.settings);expect(()=>validateWorkspace(next)).not.toThrow();
});
test('History deletion preserves the active conversation, drafts and connection settings; deleting the last creates an empty session',()=>{
 const w=emptyWorkspace(),other=newSession('Old topic');w.sessions.push(other);w.sessions[0].view.drafts.main='Keep this draft';const config=structuredClone(w.settings);
 const next=deleteConversation(w,other.id,'New conversation');expect(next.activeId).toBe(w.activeId);expect(next.sessions[0]).toEqual(w.sessions[0]);expect(next.settings).toEqual(config);expect(w.sessions).toHaveLength(2);
 const empty=deleteConversation(next,next.activeId,'新对话');expect(empty.sessions).toHaveLength(1);expect(empty.sessions[0].messages).toEqual([]);expect(empty.sessions[0].title).toBe('新对话');expect(()=>validateWorkspace(empty)).not.toThrow();
});
test('Deleting a retry removes its question and answers in the same turn',()=>{
 const w=emptyWorkspace(),s=w.sessions[0],q=message('user','Question stays'),fail=message('assistant','','error'),retry=message('assistant','Successful retry');fail.error='Could not connect';s.messages=[q,fail,retry];
 const next=deleteAnswer(s,fail.id);expect(next.messages).toEqual([]);expect(next.branches).toEqual([]);expect(s.messages).toHaveLength(3);expect(()=>validateWorkspace({...w,sessions:[next]})).not.toThrow();expect(contextFor(next,null).items).toEqual([]);
});
test('Deleting a source removes exactly its linked descendants and cleans view references while preserving siblings',()=>{
 const w=emptyWorkspace(),s=exampleSession();w.sessions=[s];w.activeId=s.id;const root=s.branches[0],nested=child(s,root,root.messages[1].id);s.branches.push(nested);const deep=child(s,nested,nested.messages[1].id);s.branches.push(deep);
 const other=message('assistant','Unrelated answer source');s.messages.push(message('user','Unrelated question'),other);const sibling=child(s,null,other.id);s.branches.push(sibling);s.view.mode='branch';s.view.branchId=deep.id;s.view.drafts={main:'Keep my draft',[nested.id]:'Remove child draft',[sibling.id]:'Keep sibling draft'};s.view.positions[nested.id]={messageId:nested.messages[1].id,offset:0,scrollTop:1};s.view.collapsed=[root.id,`turn:${nested.id}:${nested.messages[0].id}`,sibling.id];s.view.draftSource={anchor:nested.anchor,parentId:root.id};
 expect(affectedBranches(s,s.messages[1].id).size).toBe(3);const next=deleteAnswer(s,s.messages[1].id);expect(next.branches).toEqual([sibling]);expect(next.view.branchId).toBeNull();expect(next.view.mode).toBe('closed');expect(next.view.draftSource).toBeUndefined();expect(next.view.positions[nested.id]).toBeUndefined();expect(next.view.drafts).toEqual({main:'Keep my draft',[sibling.id]:'Keep sibling draft'});expect(next.view.collapsed).toEqual([sibling.id]);expect(()=>validateWorkspace({...w,sessions:[next]})).not.toThrow();
 expect(deleteAnswer({...s,view:{...s.view,mode:'tree'}},s.messages[1].id).view.mode).toBe('tree');
 expect(deleteAnswer({...s,view:{...s.view,branchId:null,draftSource:{anchor:root.anchor,parentId:null}}},s.messages[1].id).view.mode).toBe('closed');
});
test('Deletion removes an answer from every saved path without bringing archived turns into the active context',()=>{
 const w=emptyWorkspace(),s=exampleSession(),answer=message('assistant','Edited answer');const edited=editThread(s,s.messages[0].id,'Edited question',answer);w.sessions=[edited];w.activeId=edited.id;
 const next=deleteAnswer(edited,s.messages[1].id);expect(next.branches).toEqual([]);expect(next.messageHistory?.flat().some(m=>m.id===s.messages[1].id)).toBe(false);expect(activeMessages(next).at(-1)).toEqual(answer);expect(contextFor(next,null).items.some(i=>i.content===s.messages[1].text)).toBe(false);expect(()=>validateWorkspace({...w,sessions:[next]})).not.toThrow();
 const removedCurrent=deleteAnswer(next,answer.id);expect(removedCurrent.activeMessageIds).not.toContain(answer.id);expect(activeMessages(removedCurrent)).toEqual([]);expect(()=>validateWorkspace({...w,sessions:[removedCurrent]})).not.toThrow();
});
test('Deleting within an annotation leaves its parent and the main transcript unchanged, and streaming records cannot be deleted',()=>{
 const s=exampleSession(),root=s.branches[0],nested=child(s,root,root.messages[1].id);s.branches.push(nested);const next=deleteAnswer(s,root.messages[1].id);expect(next.messages).toEqual(s.messages);expect(next.branches.map(b=>b.id)).toEqual([root.id]);expect(next.branches[0].messages).toEqual([]);
 const streaming=message('assistant','','streaming');s.messages.push(streaming);expect(()=>deleteAnswer(s,streaming.id)).toThrow('Stop generation');expect(deleteAnswer(s,s.messages[0].id)).toBe(s);
});
test('Pin preferences round trip, while malformed preferences are rejected',()=>{const w=emptyWorkspace();w.settings.historyPinned=true;expect(()=>validateWorkspace(JSON.parse(JSON.stringify(w)))).not.toThrow();expect(()=>validateWorkspace({...w,settings:{...w.settings,historyPinned:'true'}})).toThrow('Invalid settings');});
