import { expect,test } from 'vitest';
import { emptyWorkspace, exampleSession, validateWorkspace, contextFor, message } from './core';
import { trashConversation, restoreConversation, expiredTrash, purgeTrash, trashLifetime } from './trash';
import { referencedAttachments } from './bridge';
import { applyContextSelection, savedContextSelection } from './context-preferences';
test('Trash preserves full records, expires at 24 hours, and restores the exact session',()=>{
 const w=emptyWorkspace(),s=exampleSession();w.sessions=[s];w.activeId=s.id;s.view.drafts.main='Private unfinished draft';s.view.contextSelections={main:[]};const before=structuredClone(s),deleted=trashConversation(w,s.id,'New conversation',1_000_000);
 expect(deleted.sessions).toHaveLength(1);expect(deleted.sessions[0].messages).toEqual([]);expect(deleted.trash?.[0].session).toEqual(before);expect(expiredTrash(deleted,1_000_000+trashLifetime-1)).toEqual([]);expect(expiredTrash(deleted,1_000_000+trashLifetime)).toEqual([s.id]);expect(expiredTrash(deleted,900_000)).toEqual([]);validateWorkspace(deleted);
 const restored=restoreConversation(deleted,s.id);expect(restored.sessions[0]).toEqual(before);expect(restored.trash).toEqual([]);expect(w.sessions[0]).toEqual(before);validateWorkspace(restored);
});
test('Trash attachments participate in backups; selective purge preserves unrelated items and settings',()=>{
 const w=emptyWorkspace(),one=exampleSession(),two=exampleSession(),file={id:crypto.randomUUID(),name:'note.txt',mime:'text/plain',kind:'text' as const,size:1};one.messages[0].attachments=[file];w.sessions.push(one,two);let next=trashConversation(w,one.id,'New');next=trashConversation(next,two.id,'New');expect(referencedAttachments(next)).toContainEqual(file);const final=purgeTrash(next,[one.id]);expect(final.trash?.map(e=>e.session.id)).toEqual([two.id]);expect(final.settings).toEqual(w.settings);expect(referencedAttachments(final)).not.toContainEqual(file);validateWorkspace(final);
});
test('Invalid recycle bin or context choices are rejected without changing original records',()=>{
 const w=emptyWorkspace();expect(()=>validateWorkspace({...w,trash:[{session:w.sessions[0],deletedAt:1}]})).toThrow();expect(()=>validateWorkspace({...w,trash:[{session:exampleSession(),deletedAt:NaN}]})).toThrow('Invalid recycle bin');w.sessions[0].view.contextSelections={main:[42 as unknown as string]};expect(()=>validateWorkspace(w)).toThrow('Invalid context selection');
});
test('Remembered selections use immutable candidate identities and do not silently add future turns',()=>{
 const s=exampleSession(),q=message('user','Current request');s.messages.push(q);const report=contextFor(s,null);const choice=savedContextSelection({...report,selected:[0,...report.required!]});s.messages.push(message('assistant','New answer'),message('user','Next request'));const selected=applyContextSelection(contextFor(s,null),choice);expect(selected.items.map(i=>i.content)).toEqual([s.messages[0].text,'Next request']);expect(applyContextSelection(contextFor(s,null),undefined).items).toHaveLength(5);expect(applyContextSelection(contextFor(s,null),[]).items.map(i=>i.content)).toEqual(['Next request']);
});
