import type { Session, Workspace } from './types';
import { activeMessages, threadPaths, switchThreadPath } from './message-history';
export interface SearchHit { key:string;sessionId:string;branchId:string|null;messageId?:string;revision?:string;kind:'title'|'message'|'note'|'organized';text:string;start:number;end:number;archived:boolean }
interface RecordEntry extends Omit<SearchHit,'start'|'end'> { folded:string;offsets?:number[] }
// Lowercase by code point with an offset map; Turkish dotted-I and emoji must not shift source offsets.
function fold(text:string){const folded=text.toLowerCase();if(folded.length===text.length)return {folded};let offset=0;const offsets:number[]=[];for(const char of text){const lower=char.toLowerCase();for(let i=0;i<lower.length;i++)offsets.push(offset);offset+=char.length;}offsets.push(text.length);return {folded,offsets};}
const cache=new WeakMap<Session,RecordEntry[]>();
export function searchEntries(session:Session):RecordEntry[]{
 const cached=cache.get(session);if(cached)return cached;
 const entries:RecordEntry[]=[];
 const add=(item:Omit<RecordEntry,'folded'|'offsets'>)=>entries.push({...item,...fold(item.text)});
 add({key:session.id+':title',sessionId:session.id,branchId:null,kind:'title',text:session.title,archived:false});
 for(const thread of [session,...session.branches]){
  const branchId='anchor' in thread?thread.id:null,active=new Set(activeMessages(thread).map(m=>m.id)),seen=new Set<string>();
  for(const path of threadPaths(thread))for(const m of path){const key=`${branchId??'main'}:${m.id}:${m.revision}`;if(seen.has(key))continue;seen.add(key);add({key:session.id+':'+key,sessionId:session.id,branchId,messageId:m.id,revision:m.revision,kind:'message',text:m.text,archived:!active.has(m.id)});}
  if('anchor'in thread&&thread.note)add({key:session.id+':note:'+thread.id,sessionId:session.id,branchId,kind:'note',text:thread.note,archived:false});
 }
 if(session.learningDraft?.text)add({key:session.id+':organized',sessionId:session.id,branchId:null,kind:'organized',text:session.learningDraft.text,archived:false});
 cache.set(session,entries);return entries;
}
export function searchWorkspace(sessions:Session[],query:string,limit=80):{hits:SearchHit[];more:boolean}{
 const needle=query.trim().toLowerCase();if(!needle)return {hits:[],more:false};const hits:SearchHit[]=[];
 for(const session of sessions)for(const entry of searchEntries(session)){
  const at=entry.folded.indexOf(needle);if(at<0)continue;if(hits.length===limit)return {hits,more:true};
  const start=entry.offsets?.[at]??at,last=at+needle.length,end=entry.offsets?(entry.offsets[last]===entry.offsets[last-1]?entry.offsets[last+1]:entry.offsets[last]):last;
  const {folded:_,offsets:__,...hit}=entry;hits.push({...hit,start,end:end??entry.text.length});
 }
 return {hits,more:false};
}
export function revealSearchHit(session:Session,hit:SearchHit):Session{
 let next=session;
 if(hit.messageId){const thread=hit.branchId?session.branches.find(b=>b.id===hit.branchId):session;if(thread){const path=threadPaths(thread).find(p=>p.some(m=>m.id===hit.messageId&&m.revision===hit.revision));if(path){if(hit.branchId)next={...session,branches:session.branches.map(b=>b.id===hit.branchId?switchThreadPath(b,path):b)};else next=switchThreadPath(session,path);}}}
 const key=hit.branchId??'main';return {...next,view:{...next.view,mode:hit.branchId?'branch':'closed',branchId:hit.branchId,positions:{...next.view.positions,[key]:{messageId:hit.messageId??'',offset:0,scrollTop:0}}}};
}
