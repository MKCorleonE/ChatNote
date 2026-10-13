import {beforeEach,expect,test,vi} from 'vitest';
import {emptyWorkspace,exampleSession} from './core';
import {trashLifetime,trashConversation,purgeTrash} from './trash';
const native=vi.hoisted(()=>({raw:null as string|null,calls:[] as string[]}));
vi.mock('@tauri-apps/api/core',()=>({isTauri:()=>true,Channel:class{},invoke:async(name:string,args?:any)=>{native.calls.push(name);if(name==='load_workspace')return native.raw;if(name==='connection_status')return{};if(name==='save_workspace')native.raw=args.payload;if(name==='purge_conversations')native.raw=args.payload;}}));
import {loadWorkspace,saveWorkspace,purgeWorkspace,backupWorkspace} from './bridge';
beforeEach(()=>{native.raw=null;native.calls=[];});
test('Startup cleans only expired recycled records and persists the cleaned workspace before returning',async()=>{
 const w=emptyWorkspace(),expired=exampleSession(),recent=exampleSession();w.sessions.push(expired,recent);let next=trashConversation(w,expired.id,'New',Date.now()-trashLifetime);next=trashConversation(next,recent.id,'New',Date.now()-1000);native.raw=JSON.stringify(next);const loaded=await loadWorkspace();expect(loaded!.trash!.map(e=>e.session.id)).toEqual([recent.id]);expect(JSON.parse(native.raw!).trash.map((e:any)=>e.session.id)).toEqual([recent.id]);expect(native.calls).toEqual(['load_workspace','connection_status','save_workspace','purge_conversations']);native.calls=[];await loadWorkspace();expect(native.calls).toEqual(['load_workspace','connection_status']);expect(loaded!.settings).toEqual(w.settings);
});
test('Queued old saves precede permanent cleanup and cannot restore deleted items afterwards',async()=>{
 const w=emptyWorkspace(),s=exampleSession();w.sessions.push(s);const before=trashConversation(w,s.id,'New'),after=purgeTrash(before,[s.id]);const old=saveWorkspace(before),purged=purgeWorkspace(before,after,[s.id]);await Promise.all([old,purged]);expect(JSON.parse(native.raw!).trash).toEqual([]);expect(native.calls.at(-1)).toBe('purge_conversations');const backup=await backupWorkspace(after);expect(backup.trash).toEqual([]);expect(backup.settings).toEqual(w.settings);
});
